let xPointsTs = [];
let yPointsCpu = [];
let yPointsCpuBuild = [];
let yPointsMem = []; 

async function getData() {
  const parsedData = await fetch("./appProfile.json");
  const data = await parsedData.json();
  const sessionData = await fetch("./sessionData.json");
  const session = await sessionData.json();
  const splitData = await fillCpuMemData(data);
  
  xPointsTs = splitData[0]
  yPointsCpu = splitData[1]
  yPointsCpuBuild = splitData[2]
  yPointsMem = splitData[3]

  const summary = getSummaryMetrics(yPointsCpuBuild, yPointsMem)

  document.getElementById('title').innerHTML = session.testName + " test"
  document.getElementById('app_version').innerHTML = session.appVersion
  document.getElementById('os_version').innerHTML = session.osVersion
  document.getElementById('device').innerHTML = session.sessionDevice
  document.getElementById('cpuAvg').innerHTML = summary[0];
  document.getElementById('cpuHigh').innerHTML = summary[1];
  document.getElementById('memHigh').innerHTML = summary[2];
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