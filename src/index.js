const core = require('@actions/core');
const fs = require('fs-extra');
const axios = require('axios');
const { stringify } = require('querystring');

const bs_username = core.getInput('bs_username');
const bs_access_key = core.getInput('bs_access_key');
const bs_session_id = core.getInput('bs_session_id');
const subfolder = core.getInput('subfolder');
const gh_run_numb = core.getInput('github_run_num');
const keep_reports = core.getInput('keep_reports');

// Creating working directory and copying over paste reports
const workingPath = "performance/" + subfolder + "/" + gh_run_numb;
if (!fs.existsSync('gh-pages')){
    fs.mkdirSync('gh-pages');
}
fs.mkdirSync('performance', {recursive: true });
fs.copySync('gh-pages', "performance", {recursive: true});
fs.mkdirSync(workingPath, {recursive:true});
fs.copyFileSync("parseData.js", workingPath + "/parseData.js")
fs.copyFileSync("index.html", workingPath + "/index.html")

// Delete old reports if reports count is greater than keep reports 
let folderDir = fs.readdirSync("performance/" + subfolder)
let i = 0;
while(folderDir.length > keep_reports){
    fs.rmSync("performance/" + subfolder + "/" + folderDir[i], { recursive: true })
    folderDir = fs.readdirSync("performance/" + subfolder)
    i++
}

// Set header for Browserstack api calls
const creds = Buffer.from(bs_username + ':' + bs_access_key, 'binary').toString('base64');
const header = {
                    'Content-Type': 'application/json',
                    "Accept" : "application/json",
                    'Authorization': 'Basic ' + creds, 
                }

// Get app profile data for specific session
async function getBSAppProfileData(){
    const response = await axios.get('https://app-automate.browserstack.com/api/v1/sessions/' + bs_session_id + '/app_profiling', {headers: header})
    const initialTs = response.data[0].ts;
    
    for await (let data of response.data){
        const time = data.ts - initialTs
        const minutes = Math.floor(time/60).toString().padStart(2,'0');
        const seconds = Math.floor(time % 60).toString().padStart(2,'0');
        data.ts = minutes + ":" + seconds
    }

    const splitData = await fillCpuMemData(response.data)
    const metrics = getSummaryMetrics(splitData[2], splitData[3])

    const cpuThreshold = core.getInput('cpu_threshold')
    if(cpuThreshold < metrics[1]) {
        core.setOutput('cpu_max', "cpu exceeded threshold")
    } else {
        core.setOutput('cpu_max', "cpu below threshold")
    }

    fs.writeFileSync(workingPath + '/appProfile.json', JSON.stringify(response.data))
}

async function getSessionData(){
    const response = await axios.get('https://api.browserstack.com/app-automate/sessions/' + bs_session_id, {headers: header})
    return response.data.automation_session
}

async function parseSessionData(){
    const session = await getSessionData()
    const testName = subfolder.charAt(0).toUpperCase() + subfolder.slice(1);
    const jsonData = {};
    jsonData["testName"] = testName;
    jsonData["sessionDevice"] = session.device;
    jsonData["osVersion"] = session.os_version;
    jsonData["appVersion"] = session.app_details.app_version;

    core.setOutput('build', session.app_details.app_version);

    fs.writeFileSync(workingPath + '/sessionData.json', JSON.stringify(jsonData))
}

// Get videos record of specific session
async function getBSVideoRecord(){
    const session = await getSessionData();
    const videoUrl = session.video_url;

    const videoDownload = await axios.get(videoUrl,    
 {     
    responseType: 'stream',
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    headers: header
})

 const writer = fs.createWriteStream( workingPath + "/video.mp4")
 await videoDownload.data.pipe(writer)
}

function getSummaryMetrics(cpu, mem){
    const averageCpu = cpu.reduce((a,b) => a + b) / cpu.length
    const highestCPU = Math.max(...cpu)
    const highestMEM = Math.round(Math.max(...mem))

    return [averageCpu, highestCPU, highestMEM]
}

async function fillCpuMemData(data){
    const ts = [];
    const cpu = [];
    const cpuBuild = [];
    const memBuild = [];

    const keys = Object.keys(data[0])
    data.forEach(points => {
      ts.push(points.ts)
      cpu.push(points.cpu)
      if(keys.includes("comhingehealthphoenixnightly_cpu")){
        cpuBuild.push(points.comhingehealthphoenixnightly_cpu)
        memBuild.push(points.comhingehealthphoenixnightly_mem)
      } else if (keys.includes("comhingehealthphoenixdev_cpu")){
        cpuBuild.push(points.comhingehealthphoenixdev_cpu)
        memBuild.push(points.comhingehealthphoenixdev_mem)
      } else {
        cpuBuild.push(points.comhingehealthphoenix_cpu)
        memBuild.push(points.comhingehealthphoenix_mem)
      }
    })
    return await [ts, cpu, cpuBuild, memBuild]
}

getBSAppProfileData();
parseSessionData();
getBSVideoRecord();
