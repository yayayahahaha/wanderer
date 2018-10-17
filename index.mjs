// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import request from 'request';
import {
    TaskSystem
} from './flyc-lib/utils/TaskSystem';

var task1 = new TaskSystem([function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            reject('1-1-1-1-1-1-1-1');
        }, 100 * 1 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('2-2-2-2-2-2-2-2');
        }, 100 * 2 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('3-3-3-3-3-3-3-3');
        }, 100 * 3 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('4-4-4-4-4-4-4-4');
        }, 100 * 4 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('5-5-5-5-5-5-5-5');
        }, 100 * 5 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('6-6-6-6-6-6-6-6');
        }, 100 * 6 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('7-7-7-7-7-7-7-7');
        }, 100 * 7 * 3);
    });
}, function() {
    return new Promise((resolve, reject) => {
        setTimeout(function() {
            resolve('8-8-8-8-8-8-8-8');
        }, 100 * 8 * 3);
    });
}, 9], [], 2);
(async function() {
    return;
    var a = await task1.doPromise();
})();


var currentSESSID = '35210002_3f5f551db1e08d29d3c4dd07f6469308';

// var keyword = 'kill la kill',
var keyword = 'darling in the franxx',
    page = 1,
    totalPages = null,
    totalCount = null,
    likedLevel = 50;

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
    };

firstSearch(getSearchUrl(keyword, page));

async function firstSearch(url) {
    console.log('');
    console.log(`欲查詢的關鍵字是: ${keyword}`);
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
    console.log(`搜尋結束, 總筆數有 ${totalCount} 件, 共 ${totalPages} 頁`); // !! 與實際頁面數不符，沒有登入好像只有 10 頁
    console.log(`開始從中挑選出愛心數大於 ${likedLevel} 顆的連結..`);

    var images = JSON.parse($('#js-mount-point-search-result-list').attr('data-items'));
    images = images.filter((illust, index) => {
        return illust.bookmarkCount >= likedLevel;
    });

    var functionArray = [];
    for (var i = 0; i < images.length; i++) {
        var img = images[i];

        // 會有function 的值吃到重複的問題
        functionArray.push(function() {
            return new Promise((resolve, reject) => {
                axios({
                    method: 'get',
                    url: img.url,
                    data: {
                        key: "value"
                    },
                    headers: getSinegleHeader(img.userId)
                }).then(() => {
                    resolve(`${ img.illustTitle } success!`);
                }).catch(() => {
                    reject(`${ img.illustTitle } failed!!!`);
                })
            })
        });
    }

    var task_search = new TaskSystem(functionArray);
    var aaa = await task_search.doPromise();
    console.log(aaa);

    // 用來測試實際取到的結果
    fs.writeFileSync('result', data);
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