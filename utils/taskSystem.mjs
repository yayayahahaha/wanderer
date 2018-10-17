function TaskSystem(jobsArray = [], resultArray = [], taskNumber = 5, callback = Function.prototype, setting = {}) {
    this.jobsArray = jobsArray.slice(); // 任務列表
    this.resultArray = resultArray; // 回傳列表，任務結果會append 在後面
    this.callback = callback; // 任務完成後的callback
    this.taskNumber = taskNumber; // 總共要起幾個task 去執行佇列

    this.workingTasksNumber = 0; // 當前還沒結束的task 數量
    this.totalJobsNumber = this.jobsArray.length; // 總任務數量
    this.finishedJobs = 0; // 完成的任務數量

    this._doJobs = async function(resolve) {
        var job = null,
            jobReault = null,
            lastOne = false;

        // 佇列里已無工作的時候
        if (this.jobsArray.length === 0) {
            this.workingTasksNumber--;

            // 檢查現在還有沒有沒停止的task
            if (this.workingTasksNumber === 0) {
                this.callback(this.resultArray);
                resolve(this.resultArray);
            }
            return;
        }

        // 從任務列表裡取出任務
        job = this.jobsArray.splice(0, 1)[0];

        // 判斷取出的任務是function 還是純粹的值
        // 如果是值，這裡目前沒做Object 或Array 的深度複製
        jobReault = typeof job === 'function' ? await job().then((response) => {
            return {
                status: 1,
                data: response,
                meta: job
            };
        }).catch((error) => {
            return {
                status: 0,
                data: error,
                meta: job
            };
        }) : {
            status: 1,
            data: job,
            meta: job
        };

        // 秀給console 的文字
        this.finishedJobs++;
        var status = jobReault.status ? 'success' : 'failed',
            of = `${ this.finishedJobs } / ${ this.totalJobsNumber }`,
            persent = parseInt(this.finishedJobs, 10) * 100 / parseInt(this.totalJobsNumber, 10);

        persent = Math.round(persent * Math.pow(10, 2)) / 100;
        persent = `${ persent.toFixed(2) }%`;

        console.log(`${of}, ${persent}, ${status}`);

        this.resultArray.push(jobReault);

        this._doJobs(resolve);
    }

    this.doPromise = () => {
        return new Promise((resolve, reject) => {
            if (this.jobsArray.length === 0) {
                console.log('warning: 傳入的jobs 陣列為空');
                resolve(this.resultArray);
                return;
            }

            console.log(`要執行的任務共有 ${ this.jobsArray.length } 個`);
            console.log(`分給 ${ this.taskNumber } 個task 去執行`);
            this.workingTasksNumber = this.taskNumber;
            for (var i = 0; i < this.taskNumber; i++) {
                this._doJobs(resolve);
            }
        })
    }
    // this.doPromise();
}

export {
    TaskSystem
};