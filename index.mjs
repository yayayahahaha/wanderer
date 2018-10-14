// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);

var url = 'https://www.pixiv.net/search.php?s_mode=s_tag&word=',
    keyword = 'kill la kill';

url = `${url}${keyword}`;

// getSearchPage(url);
getSingleImage('https://i.pximg.net/img-master/img/2015/07/11/15/56/58/51359343_p0_master1200.jpg');

// url
// https://i.pximg.net/img-master/img/2014/07/13/20/39/04/44690099_p0_master1200.jpg
// referer
// https://www.pixiv.net/member_illust.php?mode=medium&illust_id=44690099

async function getSearchPage(url) {
    var [data, error] = await axios.get(url)
        .then(({
            data
        }) => {
            return [data, null];
        })
        .catch((err) => {
            return [null, err];
        });

    if (error) {
        console.log('發生錯誤了');
        console.log(error.request);
        return;
    }

    console.log(data);
}

// TODO:
透過搜尋的關鍵字的總total 決定爬幾頁後爬完
且，透過標籤上的愛心數決定哪些才要爬

爬完之後，將要爬的id 依照作者分類
這時就可以產生出作者對id 的單一key 了
用來做快速比對的時候很好用
接著再分成圖堆和單一圖片

作者創資料夾
圖堆創資料夾
單圖也放在集中的資料夾

不過這樣無法逐一檢視
所以可能在整個掃完後再特別產一個列表處理這樣