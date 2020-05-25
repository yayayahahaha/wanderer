// please make sure your nodejs version is higher than 10.4.0

// TODO
// 快取的機制的改進：
// 清除快取的指令，清除全部、清除部分等等的
// 全域變數的減少使用，如cacheDirectory 或keyword 等
// 還有模組化各個function 之類的
// 完成就可以嘗試多重keyword 了

// OTHERS TODO
// 依作者分類
// 計算作者總星星數和取出基本資訊
// 作者排序
// 攤平瀏覽
// 查詢結果如果過多的話該怎麼辦?
// electron 平台的實作
// Puppeteer 操偶師的實作必要性研究

import axios from 'axios'
import fs from 'fs'
import os from 'os'
import flyc from 'npm-flyc'

const {
  TaskSystem,
  download
} = flyc // nodejs 的import 似乎無法直接解構?
// TODO
// SESSID 的部分可以嘗試打post api 傳遞帳密後直接取得之類的
// 或是取得多組SESSID 後放進array 做輪詢減少單一帳號的loading 之類的
let currentSESSID = ''

const eachPageInterval = 60

const getSearchHeader = function() {
  if (!currentSESSID) console.log('getSearchHeader: currentSESSID 為空！')
  return {
    'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
    cookie: `PHPSESSID=${currentSESSID};`
  }
}
const getSinegleHeader = function(illustId) {
  if (!illustId) {
    console.log('getSinegleHeader: 請務必輸入illustId')
    return {}
  }
  return {
    referer: `https://www.pixiv.net/artworks/${illustId}`
  }
}
const getKeywordsInfoUrl = function(keyword, page = 1) {
  const url = `https://www.pixiv.net/ajax/search/artworks/${keyword}?word=${keyword}&order=date&mode=all&p=${page}&s_mode=s_tag&type=all`
  return encodeURI(url)
}
const taskNumberCreater = function() {
  const cpus = os.cpus()
  const cpusAmount = cpus.length
  const cpuSpec = cpus.reduce(function(cardinalNumber, cpu) {
    let total = 0
    for (const item in cpu.times) {
      total += cpu.times[item]
    }
    return cardinalNumber + (cpu.times.idle * 100 / total)
  }, 0) / cpusAmount

  const memory = os.freemem() / Math.pow(1024, 3) // GB

  const taskNumber = memory * cpuSpec / 10

  return Math.round(taskNumber)
}
const defaultTaskSetting = function() {
  return {
    randomDelay: 0
  }
};

// 故事從這裡開始
(async(eachPageInterval = 60) => {
  // 確認input 資料
  const inputChecked = inputChecker()
  if (!inputChecked) return

  // 宣告變數
  const {
    keyword,
    likedLevel,
    // maxPage, 暫時沒有用到
    currentSESSID: ssid
  } = inputChecked
  currentSESSID = ssid // TODO: avoid using global variable

  // 取得該搜尋關鍵字的基本資訊
  console.log(`搜尋的關鍵字: ${keyword}`)
  console.log('')
  const keywordInfo = await firstSearch(keyword)
  if (!keywordInfo) return

  const totalPages = Math.ceil(keywordInfo.total / eachPageInterval)
  console.log(`共有 ${keywordInfo.total} 筆， ${totalPages} 頁`)

  let allPagesImagesArray = await getRestPages(keyword, totalPages)
  allPagesImagesArray = [keywordInfo].concat(allPagesImagesArray)

  // 扁平化
  allPagesImagesArray = allPagesImagesArray.reduce((array, pageInfo) => array.concat(pageInfo.data), [])

  // 綁定bookmarkCount 和likedCount
  const formatedImagesArray = await bindingBookmarkCount(allPagesImagesArray, keyword)

  // 過濾星星數: bookmarkCount + likedCount
  const filterImagesArray = filterBookmarkCount(formatedImagesArray, likedLevel)

  // 分割出singleArray 和multipleArray
  const {
    singleArray,
    multipleArray
  } = separateSingleAndMultiple(filterImagesArray)

  // 把task 展開: singleArray 的只會有一張、multiple 的會有多張
  const singleArray_format = fetchSingleImagesUrl(singleArray)
  const multipleArray_format = await fetchMultipleImagesUrl(multipleArray)
  const totalImageArray = singleArray_format.concat(multipleArray_format)

  // 開始下載
  await startDownloadTask(totalImageArray, keyword)

  fs.writeFileSync('result.json', JSON.stringify(totalImageArray, null, 2))

  console.log('下載完成!')
})(eachPageInterval)

function request(config) {
  return axios(config).then(({
    data
  }) => [data, null]).catch((error) => [null, error])
}

function inputChecker() {
  if (!fs.existsSync('./input.json')) {
    console.log('請修改 input.json')
    return false
  }
  const contents = fs.readFileSync('./input.json')
  const inputJSON = JSON.parse(contents)

  const keyword = inputJSON.keyword
  const likedLevel = typeof inputJSON.likedLevel === 'number' ? inputJSON.likedLevel : 500
  const maxPage = typeof inputJSON.maxPage === 'number' ? inputJSON.maxPage : 0
  const currentSESSID = inputJSON.SESSID

  if (!keyword) {
    console.log('請在 input.json 檔裡輸入關鍵字')
    console.log('')
    return false
  }
  if (!currentSESSID) {
    console.log('請在 input.json 檔裡輸入SESSID')
    console.log('')
    return false
  }

  return {
    keyword,
    likedLevel,
    maxPage,
    currentSESSID
  }
}

// 第一次搜尋: 主要是取得總頁數
async function firstSearch(keyword) {
  const [firstPageData, error] = await request({
    method: 'get',
    url: getKeywordsInfoUrl(keyword),
    headers: getSearchHeader()
  })
  if (error) {
    console.error('取得資料失敗!')
    return false
  }
  return firstPageData.body.illustManga
}

// 取得其他所有頁數的資料，不包含以查找過的第一頁
async function getRestPages(keyword, totalPages) {
  const searchFuncArray = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1) continue
    searchFuncArray.push(_create_each_search_page(keyword, i))
  }
  const taskNumber = 40
  const task_search = new TaskSystem(searchFuncArray, taskNumber, defaultTaskSetting())

  let allPagesImagesArray = await task_search.doPromise()
  allPagesImagesArray = allPagesImagesArray.map((result) => result.data[0].body.illustManga)
  return allPagesImagesArray

  function _create_each_search_page(keyword, page) {
    return function() {
      return request({
        method: 'get',
        url: getKeywordsInfoUrl(keyword, page),
        headers: getSearchHeader()
      })
    }
  }
}

// 取得每個作品的連結的快取
function getPageCache(list, keyword) {
  if (!fs.existsSync('./caches/')) {
    fs.mkdirSync('./caches/')
  }

  let cacheMap = {}
  const cacheFilePath = `./caches/${keyword}.json`
  if (fs.existsSync(cacheFilePath)) {
    cacheMap = JSON.parse(fs.readFileSync(cacheFilePath))
  }
  return cacheMap
}

// 透過taskSystem 逐頁取得所有圖片的項目
// 也在這個function 找出每個圖片的星星數目
async function bindingBookmarkCount(allPagesImagesArray, keyword) {
  const allPagesImagesMap = allPagesImagesArray.reduce((map, item) => Object.assign(map, {
    [item.illustId]: item
  }), {})

  // 取得cache
  const cachedMap = getPageCache(allPagesImagesArray, keyword)
  const noCacheImages = allPagesImagesArray.filter((image) => !cachedMap[image.illustId])

  const taskArray = []
  noCacheImages.forEach((imageItem) => {
    taskArray.push(_each_image_page(imageItem.illustId))
  })
  const taskNumber = taskNumberCreater()
  const bookmarkTask = new TaskSystem(taskArray, taskNumber, defaultTaskSetting())
  const bookmarkTaskResult = await bookmarkTask.doPromise()

  const resultMap = {}
  bookmarkTaskResult.forEach((result) => Object.assign(resultMap, result.data.illust))

  // cache 部分
  const cacheFilePath = `./caches/${keyword}.json`
  Object.assign(cachedMap, resultMap)
  fs.writeFileSync(cacheFilePath, JSON.stringify(cachedMap, null, 2))

  Object.keys(allPagesImagesMap).forEach((illustId) => {
    const urls = cachedMap[illustId].urls
    const bookmarkCount = cachedMap[illustId].bookmarkCount
    const likeCount = cachedMap[illustId].likeCount
    Object.assign(allPagesImagesMap[illustId], {
      urls,
      bookmarkCount,
      likeCount
    })
  })

  return allPagesImagesMap

  function _each_image_page(illustId) {
    return function() {
      return request({
        method: 'get',
        url: `https://www.pixiv.net/artworks/${illustId}`,
        headers: getSearchHeader()
      }).then(([data]) => {
        const splitPattern1 = '<meta name="preload-data" id="meta-preload-data" content=\''
        const splitPattern2 = '</head>'
        const splitPattern3 = '\'>'
        return JSON.parse(data.split(splitPattern1)[1].split(splitPattern2)[0].split(splitPattern3)[0])
      })
    }
  }
}

// 過濾星星: 把bookmarkCount + likeCount 少於目標數的剔除
function filterBookmarkCount(map, level = 0) {
  const list = Object.keys(map).map((id) => map[id])
  return list.filter((item) => {
    const likedLevel = item.bookmarkCount + item.likeCount
    return likedLevel >= level
  })
}

// 區分出單張和組圖
function separateSingleAndMultiple(list) {
  return list.reduce((object, item) => {
    switch (item.pageCount) {
      case 1:
        object.singleArray.push(item)
        break
      default:
        object.multipleArray.push(item)
        break
    }
    return object
  }, {
    singleArray: [],
    multipleArray: []
  })
}

// fetchSingleImageUrl & fetchMultipleImageUrl:
// 用來取得圖片的真實路徑並整理好格式
function fetchSingleImagesUrl(list) {
  return list.map(({
    id,
    userId,
    illustTitle,
    userName,
    urls
  }) => {
    const key = `${id}-${userId}`
    const name = `${illustTitle}_${id}_${userName}_${userId}`
    const original = urls.original

    const typeIndex = original.split('.').length - 1
    const type = original.split('.')[typeIndex]

    const folder = ''

    return {
      id,
      userId,
      folder,
      key,
      name,
      original,
      type
    }
  })
}
async function fetchMultipleImagesUrl(list) {
  const taskArray = []
  for (let i = 0; i < list.length; i++) {
    const mulImage = list[i]
    taskArray.push(_create_get_multiple_images(mulImage.illustId))
  }
  const getMultiOriTask = new TaskSystem(taskArray, taskNumberCreater(), defaultTaskSetting())
  const getMultiOriTaskResult = await getMultiOriTask.doPromise()

  const multiMap = list.reduce((map, item) => Object.assign(map, {
    [item.illustId]: item
  }), {})

  let multiArray = []
  getMultiOriTaskResult.forEach((result) => {
    const resultItem = result.data
    const illustId = resultItem.illustId

    const {
      id,
      userId,
      illustTitle,
      userName
    } = multiMap[illustId]
    const multiImages = resultItem.data.map(({
      urls
    }) => {
      const original = urls.original
      const index = original.split(original.split(/_p\d\./)[0])[1].split('.')[0]

      const key = `${id}-${userId}-${index}`
      const name = `${illustTitle}_${id}_${userName}_${userId}${index}`

      const typeIndex = original.split('.').length - 1
      const type = original.split('.')[typeIndex]

      const folder = `${illustTitle}-${id}`

      return {
        id,
        userId,
        folder,
        key,
        name,
        original,
        type
      }
    })
    multiArray = multiArray.concat(multiImages)
  })

  return multiArray

  function _create_get_multiple_images(illustId) {
    return function() {
      return request({
        method: 'get',
        url: `https://www.pixiv.net/ajax/illust/${illustId}/pages`,
        headers: getSearchHeader()
      }).then(([data]) => {
        return Object.assign({
          illustId,
          data: data.body
        })
      })
    }
  }
}

// 開始下載
async function startDownloadTask(sourceArray, keyword) {
  if (!fs.existsSync('./images/')) {
    fs.mkdirSync('./images/')
  }

  const keywordFolder = `./images/${keyword}/`
  if (!fs.existsSync(keywordFolder)) {
    fs.mkdirSync(keywordFolder)
  }

  // for quick detect
  const existFolderMap = {
    [keywordFolder]: true
  }

  const taskArray = []
  for (let i = 0; i < sourceArray.length; i++) {
    taskArray.push(_create_download_task(sourceArray[i], keywordFolder))
  }
  const downloadTask = new TaskSystem(taskArray, taskNumberCreater(), defaultTaskSetting())
  const downloadTaskResult = await downloadTask.doPromise()

  return downloadTaskResult

  function _create_download_task(image, keywordFolder) {
    return function() {
      const folder = `${keywordFolder}${image.folder}`
      switch (true) {
        case existFolderMap[folder]:
        case fs.existsSync(folder):
          break
        default:
          fs.mkdirSync(folder)
          break
      }
      existFolderMap[folder] = true

      const url = image.original
      const filePath = `${folder}/${image.name}.${image.type}`
      const headers = getSinegleHeader(image.id)

      return download(url, filePath, {
        headers
      })
    }
  }
}
