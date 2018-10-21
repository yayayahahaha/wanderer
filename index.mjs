// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import _ from 'lodash';
import {
    TaskSystem
} from './flyc-lib/utils/TaskSystem';

var currentSESSID = '35210002_3f5f551db1e08d29d3c4dd07f6469308';

// var keyword = 'kill la kill',
// var keyword = 'skullgirl',
var keyword = 'darling in the franxx',
    page = 1,
    totalPages = null,
    totalCount = null,
    likedLevel = 3000,
    ORIGINAL_RESULT_FILE_NAME = null,
    cacheDirectory = {};

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
    var allPagesImagesArray = await firstSearch(getSearchUrl(keyword, page)),
        {
            singleArray,
            multipleArray
        } = formatAllPagesImagesArray(allPagesImagesArray);

    fetchSingleImagesUrl(singleArray);
})();

async function firstSearch(url) {
    console.log('');
    console.log(`欲查詢的關鍵字是: ${keyword}`);

    // 為了避免pixiv 負擔過重
    // 先檢查有沒有快取 && 強制更新
    // 部份更新什麼的再說
    if (cacheDirectory[getCacheFileName(keyword, false)]) {
        console.log('目前的搜尋資訊已有過快取，將使用快取進行解析: ');
        console.log(`快取的值為: ${ getCacheFileName(keyword, false) }`);
        var content = fs.readFileSync(`./cache/${ getCacheFileName(keyword, true) }`),
            allPagesImagesArray = JSON.parse(content);

        return allPagesImagesArray;
    }

    console.log(`實際搜尋的網址: ${url}`);
    console.log('開始搜尋..');

    // 快取檔檔名
    ORIGINAL_RESULT_FILE_NAME = getCacheFileName(keyword, true);

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
    console.log(`開始從中挑選出愛心數大於 ${likedLevel} 顆的連結..`);

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
                return error;
            });
        }
    }

    var task_search = new TaskSystem(taskArray, [], 16);
    var allPagesImagesArray = await task_search.doPromise();
    console.log(`產生的快取檔案為: /cache/${ ORIGINAL_RESULT_FILE_NAME }`);
    fs.writeFileSync(`./cache/${ ORIGINAL_RESULT_FILE_NAME }`, JSON.stringify(allPagesImagesArray));

    console.log('將快取資訊寫入cacheDirectory.json');
    cacheDirectory[getCacheFileName(keyword, false)] = true;
    fs.writeFileSync(`./cacheDirectory.json`, JSON.stringify(cacheDirectory));


    return allPagesImagesArray;
}

function formatAllPagesImagesArray(allPagesImagesArray) {
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
    var taskArray = [];
    for (var i = 0; i < singleArray.length; i++) {
        var eachImage = singleArray[i];
        taskArray.push(_createReturnFunction(eachImage.illustId, eachImage.userId));
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
                    data = res.slice(startIndex + illust_id_length + 2, endIndex);
                return data;
            }).catch((error) => {
                return error;
            })
        }
    }

    var task_SingleArray = new TaskSystem(taskArray, [], 32);
    var result = await task_SingleArray.doPromise();

    fs.writeFileSync('result.json', JSON.stringify(result));
    return;

    var url = 'https://www.pixiv.net/member_illust.php?mode=medium&illust_id=68688965';
    axios({
        method: 'get',
        url: `${ url }`,
        headers: Object.assign(getSinegleHeader(804978), getSearchHeader())
    }).then(({
        data: res
    }) => {
        var startIndex = res.indexOf('68688965: {'),
            endIndex = res.indexOf('},user:'),
            data = res.slice(startIndex + 8 + 2, endIndex);
        console.log(JSON.parse(data));
        // fs.writeFileSync('result.json', data);
    }).catch((error) => {
        console.error(error);
        console.log('catch');
    });
}

// TODO:
// 透過搜尋的關鍵字的總total 決定爬幾頁後爬完
// 且，透過標籤上的愛心數決定哪些才要爬

// 爬完之後，將要爬的id 依照作者分類
// 這時就可以產生出作者對id 的單一key 了
// 用來做快速比對的時候很好用
// 接著再分成圖堆和單一圖片

// 作者創資料夾
// 圖堆創資料夾
// 單圖也放在集中的資料夾

// 不過這樣無法逐一檢視
// 所以可能在整個掃完後再特別產一個列表處理這樣u