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

import axios from 'axios';
import fs from 'fs'
import os from 'os';
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import _ from 'lodash';
import flyc from 'npm-flyc';


// 操偶師: 瀏覽器模擬器
import puppeteer from 'puppeteer';

const {
  TaskSystem,
  download
} = flyc; // nodejs 的import 似乎無法直接解構?
// TODO
// SESSID 的部分可以嘗試打post api 傳遞帳密後直接取得之類的
// 或是取得多組SESSID 後放進array 做輪詢減少單一帳號的loading 之類的
var currentSESSID = '';

let eachPageInterval = 60,
  totalCount = null,
  likedLevel = 100, // 星星數
  maxPage = 0, // 最大頁數

  ORIGINAL_RESULT_FILE_NAME = null,
  cacheDirectory = {};

var firstSearchTaskNumber = 16,
  singleArrayTaskNumber = 8,
  mangoArrayTaskNumber = 8,
  downloadTaskNumber = 4;

const getSearchHeader = function() {
    return {
      'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
      cookie: `PHPSESSID=${currentSESSID};`
    };
  },
  getSinegleHeader = function(createrID, mode) {
    mode = mode ? mode : 'medium';
    if (!createrID) {
      console.log('請務必輸入該作者的ID');
      return {};
    }
    return {
      referer: `https://www.pixiv.net/member_illust.php?mode=${ mode }&illust_id=${createrID}`
    };
  },
  getKeywordsInfoUrl = function(keyword, page = 1) {
    const url = `https://www.pixiv.net/ajax/search/artworks/${keyword}?word=${keyword}&order=date&mode=all&p=${page}&s_mode=s_tag&type=all`
    return encodeURI(url);
  },
  getSearchUrl = function(keyword, page) {
    const url = `https://www.pixiv.net/tags/${keyword}/artworks?p=${page}&s_mode=s_tag&order=date`
    return encodeURI(url);
  },
  getCacheFileName = function(keyword = 'pixiv', jsonEnd = false) {
    var base = `${ keyword.replace(/ /g, '_') }`;
    return jsonEnd ? `${ base }.json` : base;
  },
  taskNumberCreater = function() {
    var cpus = os.cpus(),
      cpusAmount = cpus.length,
      cpuSpec = cpus.reduce(function(cardinalNumber, cpu) {
        var total = 0;
        for (var item in cpu.times) {
          total += cpu.times[item];
        }
        return cardinalNumber + (cpu.times.idle * 100 / total);
      }, 0) / cpusAmount;

    var memory = os.freemem() / Math.pow(1024, 3); // GB

    var taskNumber = memory * cpuSpec / 10;

    return Math.round(taskNumber);
  }

// TODO
// 檢查是否存在的部分一定要做成library

// 檢查cacheDirectory.json 是否存在
if (!fs.existsSync('./cacheDirectory.json')) {
  fs.writeFileSync('cacheDirectory.json', JSON.stringify({}));
} else {
  var contents = fs.readFileSync('./cacheDirectory.json'),
    json = JSON.parse(contents);
  cacheDirectory = json;
}
// 檢查cache/ 是否存在
if (!fs.existsSync('./cache/')) {
  fs.mkdirSync('./cache/');
}
// 檢查log/ 是否存在
if (!fs.existsSync('./log/')) {
  fs.mkdirSync('./log/');
}

// 故事從這裡開始
(async ({
  eachPageInterval
}) => {
  if (!fs.existsSync('./input.json')) {
    console.log('請修改 input.json');
    return;
  }
  const contents = fs.readFileSync('./input.json'),
    inputJSON = JSON.parse(contents);

  const keyword = inputJSON.keyword;
  const likedLevel = typeof inputJSON.likedLevel === 'number' ? inputJSON.likedLevel : 500;
  const maxPage = typeof inputJSON.maxPage === 'number' ? inputJSON.maxPage : 0;
  const currentSESSID = inputJSON.SESSID;

  if (!keyword) {
    console.log('請在 input.json 檔裡輸入關鍵字');
    console.log('');
    return;
  }
  if (!currentSESSID) {
    console.log('請在 input.json 檔裡輸入SESSID');
    console.log('');
    return;
  }

  // 確認input 資料完畢，開始fetch

  // 取得該搜尋關鍵字的基本資訊
  const keywordInfo = await firstSearch(keyword)
  const totalPages = Math.ceil(keywordInfo.total / eachPageInterval)
  console.log(`共有 ${keywordInfo.total} 筆， ${totalPages} 頁`);

  let allPagesImagesArray = await getRestPages(keyword, totalPages)
  allPagesImagesArray = [keywordInfo].concat(allPagesImagesArray)

  // 綁定bookmarkCount 和likedCount
  const formatedImagesArray = await bindingBookmarkCount(allPagesImagesArray);

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

  fs.writeFileSync('result.json', JSON.stringify(singleArray_format, null, 2))
  return

  var totalCount = 0,
    successCount = 0,
    failedCount = 0;

  // 還要加上單一圖片和多重圖片的各別數字
  console.log('');
  console.log('==============================');
  console.log(`關鍵字: ${ keyword }`);
  console.log(`愛心數: > ${ likedLevel }`);
  console.log(`總筆數: ${ totalCount }`);
  console.log(`總成功數: ${ successCount }`);
  console.log(`總失敗數: ${ failedCount }`);

})({
  eachPageInterval
});

function request(config) {
  return axios(config).then(({
    data
  }) => [data, null]).catch((error) => [null, error])
}

async function firstSearch(keyword) {
  const [firstPageData, error] = await request({
    method: 'get',
    url: getKeywordsInfoUrl(keyword),
    headers: getSearchHeader()
  })
  if (error) {
    console.erro('取得資料失敗!');
    return
  }
  return firstPageData.body.illustManga
}

async function getRestPages(keyword, totalPages) {
  const searchFuncArray = []
  // for (let i = 1; i <= totalPages; i++) {
  for (let i = 1; i <= 1; i++) {
    if (i === 1) continue
    searchFuncArray.push(_create_each_search_page(keyword, i))
  }
  const taskNumber = taskNumberCreater(),
    task_search = new TaskSystem(searchFuncArray, 40);

  let allPagesImagesArray = await task_search.doPromise();
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

async function bindingBookmarkCount(allPagesImagesArray) {
  const flattenArray = allPagesImagesArray.reduce((array, pageInfo) => array.concat(pageInfo.data), [])
  const allPagesImagesMap = flattenArray.reduce((map, item) => Object.assign(map, {
    [item.illustId]: item
  }), {})

  const taskArray = []
  flattenArray.forEach((imageItem) => {
    taskArray.push(_each_image_page(imageItem.illustId))
  })
  const taskNumber = taskNumberCreater(),
    bookmarkTask = new TaskSystem(taskArray, taskNumber),
    bookmarkTaskResult = await bookmarkTask.doPromise();

  const resultMap = {}
  bookmarkTaskResult.forEach((result) => Object.assign(resultMap, result.data.illust))
  Object.keys(allPagesImagesMap).forEach((illustId) => {
    const urls = resultMap[illustId].urls
    const bookmarkCount = resultMap[illustId].bookmarkCount
    const likeCount = resultMap[illustId].likeCount
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
        const splitPattern1 = `<meta name="preload-data" id="meta-preload-data" content='`
        const splitPattern2 = `</head>`
        const splitPattern3 = `'>`
        return JSON.parse(data.split(splitPattern1)[1].split(splitPattern2)[0].split(splitPattern3)[0])
      })
    }
  }
}

function filterBookmarkCount(map, level = 0) {
  const list = Object.keys(map).map((id) => map[id])
  return list.filter((item) => {
    const likedLevel = item.bookmarkCount + item.likeCount
    return likedLevel >= level
  })
}

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

function fetchSingleImagesUrl(list) {
  return list.map(({id, userId, illustTitle, userName, urls}) => {
    const key = `${id}-${userId}`
    const name = `${illustTitle}_${id}_${userName}_${userId}`
    const original = urls.original

    const typeIndex = original.split('.').length - 1
    const type = original.split('.')[typeIndex]

    const folder = ''

    return {
      folder,
      key,
      name,
      original,
      type
    }

  })
}
async function fetchMultipleImagesUrl() {}


async function startDownloadTask(sourceArray = [], {
  mode
}) {
  var taskArray = [],
    task_download = null,
    cacheLog = [],
    result = [];

  for (var i = 0; i < sourceArray.length; i++) {
    var imageInfo = sourceArray[i];

    // 先檢查快取的原因是避免被randomDelay 拖到時間
    if (_eachImageDownloadedChecker(imageInfo.cacheKey) === imageInfo.url) {

      // 檢查實際上有沒有那隻檔案
      // 不放在一起檢查是避免明明沒有cache 卻還要走file system 的成本
      if (fs.existsSync(imageInfo.filePath)) {
        cacheLog.push(`已下載過 ${imageInfo.filePath}，不重複下載`);
        result.push({
          status: 1,
          data: `已下載過 ${imageInfo.filePath}，不重複下載`,
          meta: imageInfo
        });
        continue;
      }
    }

    taskArray.push(_createReturnFunction(imageInfo));
  }

  // 有檔案因為下載過而不重複下載時需提示使用者
  if (cacheLog.length !== 0) {
    var cacheLogFileName = `${ ORIGINAL_RESULT_FILE_NAME }.cache.downloaded.log.json`;
    console.log(`!!有部分檔案來源為快取，詳見 ./log/${ cacheLogFileName }`);
    fs.writeFileSync(`./log/${cacheLogFileName}`, JSON.stringify(cacheLog, null, 2));
  }

  if (taskArray.length !== 0) {
    var taskNumber = taskNumberCreater(),
      task_download = new TaskSystem(taskArray, taskNumber);
    result = await task_download.doPromise();
  }

  // 這裡應該已經完成了 : D
  fs.writeFileSync('cacheDirectory.json', JSON.stringify(cacheDirectory, null, 2));
  console.log('下載完畢');
  return result;

  // 因為hoist 的關係就算宣告式放在return 後面也沒關係
  function _createReturnFunction(object) {
    var url = object.url,
      filePath = object.filePath,
      userId = object.userId,
      illustId = object.illustId,
      headers = getSinegleHeader(userId, mode),
      cacheKey = object.cacheKey;

    return function() {
      return download(url, filePath, {
        headers,
        callback: function(status, cacheKey) {
          if (!status) return;
          cacheDirectory[ORIGINAL_RESULT_FILE_NAME][cacheKey].downloaded = url;
        },
        callbackParameter: cacheKey
      });
    };
  }

  function _eachImageDownloadedChecker(cacheKey) {
    var keywordObject = cacheDirectory[ORIGINAL_RESULT_FILE_NAME],
      eachImageObject = keywordObject[cacheKey],
      downloaded = eachImageObject.downloaded;
    return downloaded;
  }
}