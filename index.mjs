// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio'; //var $ = cheerio.load(res.data);
import request from 'request';

// var keyword = 'kill la kill',
var keyword = 'darling in the franxx',
    page = 1,
    totalPages = null,
    totalCount = null,
    likedLevel = 50;

var getSearchHeader = function() {
        return {
            // accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            // 'accept-encoding': 'gzip, deflate, br',
            'accept-language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7,ja;q=0.6,zh-CN;q=0.5',
            cookie:
                'first_visit_datetime_pc=2018-10-17+01%3A20%3A22;' +
                'p_ab_id=8;' +
                'p_ab_id_2=8;' +
                'p_ab_d_id=2064289869;' +
                'yuid_b=OGSQEHA;' +
                '__utma=235335808.1823058345.1539706823.1539706823.1539706823.1;' +
                '__utmc=235335808;' +
                '__utmz=235335808.1539706823.1.1.utmcsr=(direct)|utmccn=(direct)|utmcmd=(none);' +
                '__utmt=1;' +
                '_ga=GA1.2.1823058345.1539706823;' +
                '_gid=GA1.2.259623744.1539706836;' +
                'PHPSESSID=35210002_3f5f551db1e08d29d3c4dd07f6469308;' +
                'device_token=d5baf71a554db04c07a4481eff5386ab;' +
                'c_type=25;' +
                'a_type=0;' +
                'b_type=0;' +
                'privacy_policy_agreement=0;' +
                'login_ever=yes;' +
                '__utmv=235335808.|2=login%20ever=yes=1^3=plan=normal=1^6=user_id=35210002=1^9=p_ab_id=8=1^10=p_ab_id_2=8=1^11=lang=zh_tw=1;' +
                'user_language=zh_tw;' +
                'module_orders_mypage=%5B%7B%22name%22%3A%22sketch_live%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22tag_follow%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22recommended_illusts%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22everyone_new_illusts%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22following_new_illusts%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22mypixiv_new_illusts%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22fanbox%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22featured_tags%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22contests%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22user_events%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22sensei_courses%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22spotlight%22%2C%22visible%22%3Atrue%7D%2C%7B%22name%22%3A%22booth_follow_items%22%2C%22visible%22%3Atrue%7D%5D;' +
                'is_sensei_service_user=1;' +
                '_gat_UA-1830249-138=1;' +
                'ki_t=1539707282245%3B1539707282245%3B1539707282245%3B1%3B1;' +
                'ki_r=;' +
                '__utmb=235335808.12.10.1539706823'
            // referer: 'https://www.pixiv.net/search.php?s_mode=s_tag&word=darling%20in%20the%20franxx',
            // 'upgrade-insecure-requests': 1
        };

        // this is not enough anymore..
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
    },
    getSearchUrl = function(keyword, page) {
        return encodeURI(`https://www.pixiv.net/search.php?word=${keyword}&order=date_d&p=${page}`);
    }

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