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

  const searchFuncArray = []
  // for (let i = 1; i <= totalPages; i++) {
  for (let i = 1; i <= 10; i++) {
    if (i === 1) continue
    searchFuncArray.push(_create_each_search_page(keyword, i))
  }
  const taskNumber = taskNumberCreater(),
    task_search = new TaskSystem(searchFuncArray, 40);

  let allPagesImagesArray = await task_search.doPromise();
  allPagesImagesArray = allPagesImagesArray.map((result) => result.data[0].body.illustManga)
  allPagesImagesArray = [keywordInfo].concat(allPagesImagesArray)

  fs.writeFileSync('result.json', JSON.stringify(allPagesImagesArray, null, 2))

  function _create_each_search_page(keyword, page) {
    return function() {
      return request({
        method: 'get',
        url: getKeywordsInfoUrl(keyword, page),
        headers: getSearchHeader()
      })
    }
  }
  return

  // 將所有圖片依照單一圖檔或複數圖庫分類，已經做好likedLevel 過濾
  var {
    singleArray: singlePageArray,
    multipleArray
  } = formatAllPagesImagesArray(allPagesImagesArray);

  var totalCount = 0,
    successCount = 0,
    failedCount = 0;

  // 單一圖片的部分

  if (singlePageArray.length !== 0) {
    // 取出該單一圖檔頁面上的真實路徑
    var singleUrlArray = await fetchSingleImagesUrl(singlePageArray),
      finalUrlArray = createPathAndName(singleUrlArray);
    console.log('取得單一圖片連結完畢');

    console.log('');
    console.log('開始下載: ');
    var result = await startDownloadTask(finalUrlArray, {
      mode: 'medium' // 用來產header
    });

    // 這應該是最後了
    totalCount += result.length;
    for (var i = 0; i < result.length; i++) {
      if (result[i].status === 1) {
        successCount++;
      } else {
        failedCount++;
      }
    }

  } else {
    console.log(`單一圖片裡沒有愛心數大於 ${ likedLevel } 的圖片`);
  }

  // 多重圖片的部分
  if (multipleArray.length !== 0) {
    // 取出漫畫圖檔頁面上的真實路徑"們"
    var mangoUrlArray = await fetchMangaImagesUrl(multipleArray),
      finalMangoUrlArray = createMangoPathAndName(mangoUrlArray);
    console.log('取得多重圖片連結完畢');

    console.log('');
    console.log('開始下載');
    var resultMango = await startDownloadTask(finalMangoUrlArray, {
      mode: 'manga_big'
    });

    totalCount += resultMango.length;
    for (var i = 0; i < resultMango.length; i++) {
      if (resultMango[i].status === 1) {
        successCount++;
      } else {
        failedCount++;
      }
    }
  } else {
    console.log(`多重圖片裡沒有愛心數大於 ${ likedLevel } 的圖片`);
  }

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


  console.log('url: ', url)
  const browser = await puppeteer.launch();
  console.log('browser created');

  return new Promise(async (resolve, reject) => {
    const page = await browser.newPage();
    await page.setRequestInterception(true);

    page.on('request', (request) => {
      const headers = request.headers()
      Object.assign(headers, getSearchHeader())
      request.continue({
        headers
      })
    })

    // 實際造訪
    await page.goto(url);
    console.log('page loaded');

    const containerSelector = '.sc-LzNOT.ljRaki'
    const aLinkSelector = '.sc-fzXfQr.loDYFF'
    const combineSelector = `${containerSelector} ${aLinkSelector}`

    // TODO: 這裡要做race timeout 機制
    let [spaLoaded] = await page.waitForSelector(combineSelector).then(() => [true, null]).catch(() => [null, true]);
    if (!spaLoaded) {
      console.log('載入失敗!')
      return
    }

    const totalPages = await page.evaluate(() => {
      return document.querySelector('span.sc-LzNOm.jXwrXb').innerText
    })
    console.log('totalPages: ', totalPages);

    const pageArtWorks = await page.evaluate((selector) => {
      const aLinkList = document.querySelectorAll(`${selector}`)
      return [].map.call(aLinkList, (dom) => {
        const authorDom = dom.querySelector('div.sc-fzXfQm.cEJTuv > a')
        const artworkDom = dom.querySelector('a.sc-fzXfQs.cdGUCF')
        return {
          authorName: authorDom.innerText,
          authorId: authorDom.getAttribute('href').split('/users/')[1],
          artworkName: artworkDom.innerText,
          artworkId: artworkDom.getAttribute('href').split('/artworks/')[1],
          artworkLink: `${window.location.origin}${artworkDom.getAttribute('href')}`,
          artworkType: dom.querySelector('.sc-fzXfOZ.gOXMgf') ? 'multiple' : 'single',
          liked: 0
        }
      })
    }, combineSelector)

    fs.writeFileSync(`./puppeteer.json`, JSON.stringify(pageArtWorks, null, 2));

    await browser.close();
    return
  })
}

function formatAllPagesImagesArray(allPagesImagesArray) {}

async function fetchSingleImagesUrl(singleArray) {
  console.log('');
  console.log(`開始取得單一圖檔的各自連結`);

  var taskArray = [],
    cacheLog = [],
    cacheArray = [],
    task_SingleArray = null,
    singleImagesArray = [];

  for (var i = 0; i < singleArray.length; i++) {
    var eachImage = singleArray[i],
      authorId = eachImage.userId,
      illust_id = eachImage.illustId;

    // 檢查是否已經有過該頁面的資料
    var cacheObject = cacheDirectory[ORIGINAL_RESULT_FILE_NAME][_getSingleCacheKey(authorId, illust_id)];
    if (cacheObject) {
      cacheLog.push(`圖片 ${ _getSingleCacheKey(authorId, illust_id) } 已經有快取，圖片資訊將從快取取得`);
      cacheArray.push({
        status: 1,
        data: cacheObject,
        meta: cacheObject
      });
      continue;
    }

    taskArray.push(_createReturnFunction(eachImage.illustId, eachImage.userId));
  }

  // 如果有些檔案是從cache 來的話要提示使用者
  if (cacheLog.length !== 0) {
    var cacheLogFileName = `${ ORIGINAL_RESULT_FILE_NAME }.cache.image_info.log.json`;
    console.log(`!!有部分檔案來源為快取，詳見 log/${ cacheLogFileName }`);
    fs.writeFileSync(`./log/${cacheLogFileName}`, JSON.stringify(cacheLog, null, 2));
  }

  if (taskArray.length !== 0) {
    console.log('');
    var taskNumber = taskNumberCreater(),
      task_SingleArray = new TaskSystem(taskArray, taskNumber, {
        randomDelay: 500
      });
    singleImagesArray = await task_SingleArray.doPromise();
  }
  singleImagesArray = singleImagesArray.concat(cacheArray); //補回從cache 來的數量

  // 存進快取
  for (var i = 0; i < singleImagesArray.length; i++) {
    var eachImage = singleImagesArray[i].data;
    cacheDirectory[ORIGINAL_RESULT_FILE_NAME][eachImage.singleImageCacheKey] = eachImage;
  }
  fs.writeFileSync('./cacheDirectory.json', JSON.stringify(cacheDirectory, null, 2));


  // 濾掉失敗的檔案後整理格式回傳
  singleImagesArray = _.chain(singleImagesArray)
    .filter((eachResult) => {
      return eachResult.status === 1;
    })
    .map((imageObject) => {
      imageObject.data.downloadUrl = imageObject.data.urls.original;
      return imageObject.data;
    })
    .sort((a, b) => {
      return b.bookmarkCount - a.bookmarkCount;
    })
    .value();
  return singleImagesArray;

  function _getSingleCacheKey(authorId, illust_id) {
    return `${ authorId } - ${ illust_id }`;
  }

  function _createReturnFunction(illust_id, authorId) {
    var url = `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${ illust_id }`,
      illustId = illust_id,
      illust_id_length = illust_id.length,
      headers = Object.assign(getSinegleHeader(authorId), getSearchHeader());

    return function() {
      return axios({
        method: 'get',
        url: url,
        headers: headers
      }).then(({
        data: res
      }) => {
        var startIndex = res.indexOf(`${ illustId }: {`),
          endIndex = res.indexOf('},user:'),
          data = JSON.parse(res.slice(startIndex + illust_id_length + 2, endIndex)),
          returnObject = {
            pageUrl: url,
            userId: data.userId,
            userName: data.userName,
            illustId: data.illustId,
            illustTitle: data.illustTitle,
            illustType: data.illustType,
            urls: data.urls,
            bookmarkCount: data.bookmarkCount,
            // tags: data.tags,
            singleImageCacheKey: `${ data.userId } - ${ data.illustId }`
          };

        return returnObject;
      }).catch((error) => {
        throw error;
      })
    }
  }
}

async function fetchMangaImagesUrl(mangoArray) {
  console.log('');
  console.log(`開始取得多重圖檔的各自連結`);

  var taskArray = [],
    task_mango = null,
    cacheLog = [],
    cacheArray = [],
    mangoPagesArray = [];

  for (var i = 0; i < mangoArray.length; i++) {
    var illustId = mangoArray[i].illustId,
      userId = mangoArray[i].userId,
      userName = mangoArray[i].userName,
      pageCount = mangoArray[i].pageCount,
      bookmarkCount = mangoArray[i].bookmarkCount,
      illustTitle = mangoArray[i].illustTitle;

    for (var pageNumber = 0; pageNumber < pageCount; pageNumber++) {
      var mangoImageCacheKey = `${userId}-${illustId}-page-${pageNumber}`,
        cacheObject = cacheDirectory[ORIGINAL_RESULT_FILE_NAME][mangoImageCacheKey];

      // 檢查cache
      if (cacheObject) {
        cacheLog.push(`圖片 ${ mangoImageCacheKey } 已經有快取，圖片資訊將從快取取得`);
        cacheArray.push({
          status: 1,
          data: cacheObject,
          meta: cacheObject
        });
        continue;
      }

      taskArray.push(_createReturnFunction(illustId, pageNumber, {
        userId,
        userName,
        bookmarkCount,
        illustTitle,
        mangoImageCacheKey
      }));
    }
  }

  // 如果有些檔案是從cache 來的話要提示使用者
  if (cacheLog.length !== 0) {
    var cacheLogFileName = `${ ORIGINAL_RESULT_FILE_NAME }.cache.image_info.log.json`;
    console.log(`!!有部分檔案來源為快取，詳見 log/${ cacheLogFileName }`);
    fs.writeFileSync(`./log/${cacheLogFileName}`, JSON.stringify(cacheLog, null, 2));
  }

  // 開始抓取真實連結
  if (taskArray.length) {
    console.log('');
    var taskNumber = taskNumberCreater(),
      task_mango = new TaskSystem(taskArray, taskNumber, {
        randomDelay: 500
      });
    mangoPagesArray = await task_mango.doPromise();
  }
  mangoPagesArray = mangoPagesArray.concat(cacheArray);

  // 存進快取
  for (var i = 0; i < mangoPagesArray.length; i++) {
    var eachImage = mangoPagesArray[i].data;
    cacheDirectory[ORIGINAL_RESULT_FILE_NAME][eachImage.mangoImageCacheKey] = eachImage;
  }
  fs.writeFileSync('./cacheDirectory.json', JSON.stringify(cacheDirectory, null, 2));

  // 濾掉失敗檔案
  mangoPagesArray = mangoPagesArray.filter((item) => {
    return item.status === 1;
  });

  // 整理後回傳
  mangoPagesArray = _.chain(mangoPagesArray)
    .filter((eachResult) => {
      return eachResult.status === 1;
    })
    .map((item) => {
      return item.data;
    })
    .sort((a, b) => {
      return a['bookmarkCount'].toString().localeCompare(b['bookmarkCount'].toString()) ||
        a['userId'].toString().localeCompare(b['userId'].toString()) ||
        a['illustId'].toString().localeCompare(b['illustId'].toString()) ||
        a['page'].toString().localeCompare(b['page'].toString());
    })
    .value();
  return mangoPagesArray;

  function _createReturnFunction(illustId, page, {
    userId,
    userName,
    bookmarkCount,
    illustTitle,
    mangoImageCacheKey
  }) {
    var url = `https://www.pixiv.net/member_illust.php?mode=manga_big&illust_id=${ illustId }&page=${ page }`,
      headers = Object.assign(getSinegleHeader(userId), getSearchHeader());
    return function() {
      return axios({
        url,
        headers
      }).then(({
        data
      }) => {
        var $ = cheerio.load(data),
          downloadUrl = $('img').attr('src');

        return {
          downloadUrl,
          illustId,
          userId,
          userName,
          page,
          bookmarkCount,
          illustTitle,
          mangoImageCacheKey
        };
      }).catch((error) => {
        throw error;
      });
    }
  }
}

function createPathAndName(roughArray) {
  var finalUrlArray = [...roughArray].map((image) => {
    var spliter = image.downloadUrl.split('.'), // 取得最後的副檔名
      type = spliter[spliter.length - 1], // 由於中間也可能有 . ，所以要用最後一個

      userName = image.userName,
      illustTitle = image.illustTitle,
      illustId = image.illustId,
      fileName = `${ userName }-${ illustTitle }-${ illustId }`;

    fileName = fileName.replace(/\/|\.|\s/g, '_'); // 將可能存在的斜線和空格還有點變成底線

    var returnObject = {
      cacheKey: image.singleImageCacheKey,
      userId: image.userId,
      url: image.downloadUrl,
      filePath: `./images/${ keyword }/${ fileName }.${ type }`
    };
    return returnObject;
  });
  return finalUrlArray;
}

function createMangoPathAndName(roughArray) {
  var finalMangoUrlArray = roughArray.map((image) => {
    var spliter = image.downloadUrl.split('.'),
      type = spliter[spliter.length - 1],
      userName = image.userName,
      illustTitle = image.illustTitle,
      illustId = image.illustId,
      page = image.page,
      fileName = '';

    userName = userName.replace(/\s|\/|\./g, '_'); // 濾掉空白、斜線和點
    illustTitle = illustTitle.replace(/\s|\/|\./g, '_'); // 濾掉空白、斜線和點
    fileName = `${userName}-${illustTitle}/${illustId}-p_${page}`;

    var returnObject = {
      cacheKey: image.mangoImageCacheKey,
      userId: image.userId,
      url: image.downloadUrl,
      filePath: `./images/${ keyword }/${ fileName }.${ type }`
    };
    return returnObject;
  });
  return finalMangoUrlArray;
}

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