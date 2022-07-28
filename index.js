const Axios = require('axios')
const message = require('./message/email')
const dayjs = require('dayjs')
const config = require('./config')

const axios = Axios.create({
    baseURL:'https://pbmapi.xiaoyanggroup.com/api/'
})


const accountList = JSON.parse(config.account_list)
// console.log('accountList',accountList)

if(accountList.length>0){
    init()
}else{
    console.log('请检查config配置',config)
}


async function init(){

    // 接入接口坞的接口 判断当前是否是工作日 地址：http://www.apihubs.cn/#/holiday
  const isWorkDay =await axios.get(`https://api.apihubs.cn/holiday/get?field=workday&date=${dayjs(new Date()).format('YYYYMMDD')}&workday=1&cn=1&size=31`).then(res=>{
    // console.log('工作日',res.data.data);
      return res.data.data.list.length >0
  })
 
  // 如果不是工作日，则不执行下面的语句
  if (!isWorkDay) {
    console.log('今天不是工作日，不需要填报晓羊PBM哦~');
    return
  }

  console.log('今天是工作日，需要填报晓羊PBM哦~',new Date(dayjs(new Date()).format('YYYY-MM-DD HH:mm:ss')));
  
  accountList.forEach(item=>{
    handle(item)
  })
}


async function handle(user){
   
    // 获取用户id和token
    const {token,UserID} = await axios.post('https://pbmapi.xiaoyanggroup.com/xy/login/Mobile',{
        "password": user.password,
        "loginId": user.username,
        "icon": ""
    }).then(res=>{
        // console.log(res.data);
        return res.data.data
    })

    // console.log('token',token,'UserID',UserID)

    // 获取待完成任务列表
    const taskList = await axios.get(`https://pbmapi.xiaoyanggroup.com/api/IterationTask/GetLatelyTaskList`,{
        headers:{
            xytoken:token
        }
    }).then(res=>{

        return res.data.data.filter(item=>{
            return new Date().getTime() > new Date(item.PlanStartTime).getTime() && new Date().getTime() < new Date(item.PlanEndTime).getTime()
        })
    })


    let content = `${user.username}的填报结果

    `

    for (let i = 0; i < taskList.length; i++) {
        // const element = array[i];
        await submitTask(taskList[i],token,user.workType)
        content += `您的${taskList[i].TaskContent}任务，已填报完成，请您知晓！\n`
        
    }
    // taskList.forEach(async item=>{
    //    await submitTask(item,token,user.workType)
    //    content += `您的${item.TaskContent}任务，已填报完成，请您知晓！\n`
    // })

    console.log('content',content)
    // 消息推送
    axios.post('http://www.pushplus.plus/send',{
        "token":"cc966b4a88f14046847ab848a12e4aeb",
        "title":"晓羊PBM填报结果",
        "content":content,
        "templete":'html'
    }).then(res=>{
        console.log('消息推送结果',res.data)
    })
}

async function submitTask(task,token,workType){
    // 获取任务详情
  let taskDetail =  await axios.get('https://pbmapi.xiaoyanggroup.com/api/IterationTask/GetTaskDetail',{
        params:{
            'TaskId':task.Id
        },
        headers:{
            xytoken:token
        }
    }).then(res=>{
        // console.log('taskDetail:',res.data.data);
        return res.data.data
    })

    // 获取工作类别
    let workTypes = await axios.get('https://pbmapi.xiaoyanggroup.com/api/WorkTime/GetWorkTimeTypes',{
        params:{
            'projectId':taskDetail.ProjectId
        },
        headers:{
            xytoken:token
        }
    }).then(res=>{
        return res.data.data.map(item=>item.Items).flat(Infinity)
    })

    // console.log('workTypes',workTypes)

    const workTypeId = workTypes.find(item=>item.WorkTimeTypeName===workType||'代码开发').WorkTimeTypeId

    console.log('任务状态',{
        "fillInDateTime": dayjs(new Date()).format('YYYY-MM-DD'),
        "projectId": String(taskDetail.ProjectId),
        "fillInTime": taskDetail.WorkTimeEstimate>8?8:taskDetail.WorkTimeEstimate,
        "workType": workTypeId,
        "workDes": "",
        "taskId": String(taskDetail.Id),
        "taskState": dayjs(new Date()).format("YYYY-MM-DD") === dayjs(taskDetail.PlanEndTime).format("YYYY-MM-DD") ? 3: 2
    })

    

    // 提交PBM填报任务
    await axios.post('https://pbmapi.xiaoyanggroup.com/api/WorkTime/BatchCreateMainProjectDayWorkTime',{
        remarks:'',
        Items:[
            {
                "fillInDateTime": dayjs(new Date()).format('YYYY-MM-DD'),
                "projectId": String(taskDetail.ProjectId),
                "fillInTime": taskDetail.WorkTimeEstimate>8?8:taskDetail.WorkTimeEstimate,
                "workType": workTypeId,
                "workDes": "",
                "taskId": String(taskDetail.Id),
                "taskState": dayjs(new Date()).format("YYYY-MM-DD") === dayjs(taskDetail.PlanEndTime).format("YYYY-MM-DD") ? 3: 2
            }
        ]
    },{
        headers:{
            xytoken:token
        }
    }).then(res=>{
        console.log('填报完成-接口返回',res.data.data)
    })
    
}
