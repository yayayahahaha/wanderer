// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import request from 'request';

var baseUrl = 'https://www.pixiv.net/search.php?s_mode=s_tag&word=',
    keyword = 'kill la kill',
    url = encodeURI(`${baseUrl}${keyword}`),
    likedLevel = 50;

var getSearchHeader = function() {
        return {
            'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5'
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
    }

getSearchPage(url);
// getSingleImage('https://i.pximg.net/img-master/img/2015/07/11/15/56/58/51359343_p0_master1200.jpg');

// url
// https://i.pximg.net/img-master/img/2014/07/13/20/39/04/44690099_p0_master1200.jpg
// referer
// https://www.pixiv.net/member_illust.php?mode=medium&illust_id=44690099

async function getSearchPage(url) {
    console.log('');
    console.log(`欲查詢的關鍵字是: ${keyword}`);
    console.log(`實際搜尋的網址: ${url}`);
    console.log('開始搜尋..');
    // url = 'https://i.pximg.net/img-master/img/2014/07/13/20/39/04/44690099_p0_master1200.jpg';

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
    var $ = cheerio.load(data),
        totalCount = parseInt($('.count-badge').text(), 10);
    console.log(`搜尋結束, 總筆數有 ${totalCount} 件`);
    console.log(`開始從中挑選出愛心數大於 ${likedLevel} 顆的連結..`);
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