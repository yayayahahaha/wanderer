// please make sure your nodejs version is higher than 10.4.0

import axios from 'axios';
import fs from 'fs'
import cheerio from 'cheerio';

(async () => {
    var array = await axios({
        method: 'get',
        url: 'https://www.google.com.tw'
    }).then((res) => {
        console.log('res');
        return [res]
    }).catch((error) => {
        console.log('error');
        return [error]
    });

    console.log('done');
})();