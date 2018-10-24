// please make sure your nodejs version is higher than 10.4.0

// TODO: 開始取得單張圖片的真實url

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import _ from 'lodash';
import {
    TaskSystem
} from './flyc-lib/utils/TaskSystem';

var currentSESSID = '35210002_10fdc62a683e3cd027db6cc3d03c7615';

var keyword = '',
    page = 1,
    totalPages = null,
    totalCount = null,
    likedLevel = 100,
    maxPage = 0,
    ORIGINAL_RESULT_FILE_NAME = null,
    cacheDirectory = {};

var firstSearchTaskNumber = 16,
    singleArrayTaskNumber = 16;

var getSearchHeader = function() {
        return {
            'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
            cookie: `PHPSESSID=${currentSESSID};`
        };
    },
    getSinegleHeader = function(createrID) {
        if (!createrID) {
            console.log('請務必輸入該作者的ID');
            return {};
        }
        return {
            referer: `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${createrID}`
        };
    },
    getSearchUrl = function(keyword, page) {
        return encodeURI(`https://www.pixiv.net/search.php?word=${keyword}&order=date_d&p=${page}`);
    },
    getCacheFileName = function(keyword = 'pixiv', jsonEnd = false) {
        var base = `${ keyword.replace(/ /g, '_') }`;
        return jsonEnd ? `${ base }.json` : base;
    };

// 檢查cacheDirectory.json 是否存在
if (!fs.existsSync('./cacheDirectory.json')) {
    fs.writeFileSync('cacheDirectory.json', JSON.stringify({}));
} else {
    var contents = fs.readFileSync('./cacheDirectory.json'),
        json = JSON.parse(contents);
    cacheDirectory = json;
}

// 故事從這裡開始
(async () => {
    if (!fs.existsSync('./input.json')) {
        console.log('請修改 input.json');
        return;
    }
    var contents = fs.readFileSync('./input.json'),
        inputJSON = JSON.parse(contents);

    keyword = inputJSON.keyword;
    likedLevel = inputJSON.likedLevel ? inputJSON.likedLevel : 500;
    maxPage = inputJSON.maxPage ? inputJSON.maxPage : 0;

    if (!keyword) {
        console.log('請在 input.json 檔裡輸入關鍵字');
        return;
    }

    // 確認input 資料完畢，開始fetch

        // 取得該搜尋關鍵字的全部頁面
    var allPagesImagesArray = await firstSearch(getSearchUrl(keyword, page)),

        // 將所有圖片依照單一圖檔或複數圖庫分類，已經做好likedLevel 過濾
        { singleArray: singlePageArray, multipleArray } = formatAllPagesImagesArray(allPagesImagesArray);

    if (singlePageArray.length !== 0) {
        // 取出該單一圖檔頁面上的真實路徑
        var singleUrlArray = await fetchSingleImagesUrl(singlePageArray);

        // Next Part
        console.log(singleUrlArray.length);
    } else {
        console.log(`單一圖片裡沒有愛心數大於 ${ likedLevel } 的圖片`);
    }
})();

async function firstSearch(url) {
    console.log('');
    console.log(`欲查詢的關鍵字是: ${keyword}`);

    // 快取檔檔名
    maxPage = typeof maxPage === 'number' ? parseInt(maxPage, 10) : 0;
    ORIGINAL_RESULT_FILE_NAME = maxPage ?
        getCacheFileName(`${ keyword } - ${ maxPage }_pages`) :
        getCacheFileName(keyword);

    // 為了避免pixiv 負擔過重
    // 先檢查有沒有快取 && 強制更新
    // 部份更新什麼的再說
    if (cacheDirectory[ORIGINAL_RESULT_FILE_NAME]) {
        console.log('目前的搜尋資訊已有過快取，將使用快取進行解析: ');
        console.log(`快取的值為: ${ ORIGINAL_RESULT_FILE_NAME }.json`);
        var content = fs.readFileSync(`./cache/${ ORIGINAL_RESULT_FILE_NAME }.json`),
            allPagesImagesArray = JSON.parse(content);

        return allPagesImagesArray;
    }

    console.log(`實際搜尋的網址: ${url}`);
    console.log('開始搜尋..');

    var [data, error] = await axios({
        method: 'get',
        url: url,
        headers: getSearchHeader()
    }).then(({
        data
    }) => {
        return [data, null];
    }).catch((error) => {
        return [null, error];
    });
    if (error) {
        console.log('發生錯誤了');
        console.log(error.response.statusText);
        return;
    }

    console.log('');
    var $ = cheerio.load(data);

    totalCount = parseInt($('.count-badge').text(), 10);
    totalPages = Math.ceil(totalCount / 40);
    console.log(`搜尋結束, 總筆數有 ${totalCount} 件, 共 ${totalPages} 頁`);

    // 沒有找到任何回傳結果的時候
    if (totalCount === 0) {
        console.log(`該搜尋關鍵字 ${ keyword } 找不到任何回傳結果`);
        console.log('程式結束');
        return;
    }

    if (maxPage > 0) {
        console.log(`!!有設定最大頁數，為 ${ maxPage }頁`);
    }
    totalPages = maxPage === 0 ?
        totalPages :
        maxPage > totalPages ?
        totalPages :
        maxPage;

    var taskArray = [];
    for (var i = 0; i < totalPages; i++) {
        taskArray.push(_createReturnFunction(i));
    }

    function _createReturnFunction(number) {
        var url = getSearchUrl(keyword, number);
        return function() {
            return axios({
                method: 'get',
                url: url,
                headers: getSearchHeader()
            }).then(({
                data
            }) => {
                var $ = cheerio.load(data),
                    images = JSON.parse($('#js-mount-point-search-result-list').attr('data-items'));
                return images;
            }).catch((error) => {
                throw error;
            });
        }
    }

    var task_search = new TaskSystem(taskArray, firstSearchTaskNumber);
    var allPagesImagesArray = await task_search.doPromise();

    console.log('');
    console.log('將快取資訊寫入cacheDirectory.json');
    cacheDirectory[ORIGINAL_RESULT_FILE_NAME] = {};
    fs.writeFileSync(`./cacheDirectory.json`, JSON.stringify(cacheDirectory));

    console.log(`產生的快取檔案為: /cache/${ ORIGINAL_RESULT_FILE_NAME }.json`);
    fs.writeFileSync(`./cache/${ ORIGINAL_RESULT_FILE_NAME }.json`, JSON.stringify(allPagesImagesArray));

    return allPagesImagesArray;
}

function formatAllPagesImagesArray(allPagesImagesArray) {
    console.log('');
    console.log(`開始從中挑選出愛心數大於 ${likedLevel} 顆的連結..`);
    // 過濾掉失敗的頁數
    // !!: 過濾越早越好
    // 但不知道為什麼總數量比頁面上顯示的要少?
    allPagesImagesArray = allPagesImagesArray.filter((imageObject, index) => {
        return !!imageObject.status; // 暫時不處理失敗的部分
    }).map((imageObject) => {
        return imageObject.data; // 讓物件變成裡面的data 陣列
    });

    // 壓平所有頁數到同一個陣列
    // 且，過濾掉因為頁數邊界可能造成的重複資料和動圖
    // 過濾愛心數也在這裡
    var allImagesArray = _.chain(allPagesImagesArray)
        .flattenDepth(1)
        .filter((image) => {
            return image.bookmarkCount >= likedLevel && parseInt(image.illustType, 10) !== 2; // 目前無法解析動圖
        })
        .uniqBy('illustId')
        .sort((a, b) => {
            return a['bookmarkCount'].toString().localeCompare(b['bookmarkCount'].toString()) ||
                a['userId'].toString().localeCompare(b['userId'].toString()) ||
                a['illustId'].toString().localeCompare(b['illustId'].toString());
        })
        .value(),
        authorsObject = {},
        authorArray = [],
        singleArray = [],
        multipleArray = [];

    [].forEach.call(allImagesArray, (image, index) => {
        if (parseInt(image.illustType, 10) === 0) {
            singleArray.push(image);
        } else if (parseInt(image.illustType, 10) === 1) {
            multipleArray.push(image);
        }
    });

    return {
        singleArray,
        multipleArray
    };
    // 底下的部分其實可以當做TODO

    // 依作者分類
    for (var i = 0; i < allImagesArray.length; i++) {
        var eachImage = allImagesArray[i];
        if (authorsObject[eachImage.userId]) {
            authorsObject[eachImage.userId].push(eachImage);
        } else {
            authorsObject[eachImage.userId] = [eachImage];
        }
    }

    // 計算作者總星星數和取出基本資訊
    for (var author in authorsObject) {
        var authorImages = authorsObject[author],
            totalLikedNumber = _.sumBy(authorImages, 'bookmarkCount');

        authorsObject[author] = {
            userId: author,
            userName: authorImages[0].userName,
            totalLikedNumber: totalLikedNumber,
            images: authorImages
        };
        authorArray.push(authorsObject[author]);
    }

    // 作者排序
    authorArray.sort((a, b) => {
        return b.totalLikedNumber - a.totalLikedNumber;
    });

    console.log(`images Number: ${ allImagesArray.length }`);
    console.log(`author Number: ${ Object.keys(authorsObject).length }`);
    fs.writeFileSync('result.json', JSON.stringify(authorsObject));
}

async function fetchSingleImagesUrl(singleArray) {
    console.log('');
    console.log(`開始取得單一圖檔的各自連結`);

    var taskArray = [],
        cacheLog = [];

    for (var i = 0; i < singleArray.length; i++) {
        var eachImage = singleArray[i];
        taskArray.push(_createReturnFunction(eachImage.illustId, eachImage.userId));
    }

    function _getSingleCacheKey(authorId, illust_id) {
        return `${ authorId } - ${ illust_id }`;
    }

    function _createReturnFunction(illust_id, authorId) {
        var url = `https://www.pixiv.net/member_illust.php?mode=medium&illust_id=${ illust_id }`,
            illustId = illust_id,
            illust_id_length = illust_id.length,
            headers = Object.assign(getSinegleHeader(authorId), getSearchHeader());

        var cacheObject = cacheDirectory[ORIGINAL_RESULT_FILE_NAME][_getSingleCacheKey(authorId, illust_id)];
        if (cacheObject) {
            cacheLog.push(`圖片 ${ _getSingleCacheKey(authorId, illust_id) } 已經有快取，圖片將從快取取得`);
            return function() {
                return cacheObject;
            }
        }

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
                        userId: data.userId,
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

    // 如果有些檔案是從cache 來的話要提示使用者
    if (cacheLog.length !== 0) {
        var cacheLogFileName = `${ ORIGINAL_RESULT_FILE_NAME }.cache.log.json`;
        console.log(`!!有部分檔案來源為快取，詳見 log/${ cacheLogFileName }`);
        fs.writeFileSync(`./log/${cacheLogFileName}`, JSON.stringify(cacheLog));
    }

    console.log('');
    var task_SingleArray = new TaskSystem(taskArray, singleArrayTaskNumber);
    var singleImagesArray = await task_SingleArray.doPromise();

    // 濾掉失敗的檔案
    singleImagesArray = singleImagesArray.filter((eachResult) => {
        return eachResult.status === 1;
    });

    for (var i = 0; i < singleImagesArray.length; i++) {
        var eachImage = singleImagesArray[i].data;
        cacheDirectory[ORIGINAL_RESULT_FILE_NAME][eachImage.singleImageCacheKey] = eachImage;
    }
    fs.writeFileSync('./cacheDirectory.json', JSON.stringify(cacheDirectory));


    //TODO 傳回去之前要壓扁 + 過濾
    singleImagesArray = _.chain(singleImagesArray)
    .filter((taskObject) => {
        return taskObject.status === 1;
    })
    .map((taskObject) => {
        return taskObject.data;
    })
    .value();
    console.log(singleImagesArray);
    return singleImagesArray;

    fs.writeFileSync('result.json', JSON.stringify(cacheDirectory));
}

// TODO:
// mkdir 的錯誤捕捉

// 爬完之後，將要爬的id 依照作者分類
// 這時就可以產生出作者對id 的單一key 了
// 用來做快速比對的時候很好用
// 接著再分成圖堆和單一圖片

// 作者創資料夾
// 圖堆創資料夾
// 單圖也放在集中的資料夾

// 不過這樣無法逐一檢視
// 所以可能在整個掃完後再特別產一個列表處理這樣