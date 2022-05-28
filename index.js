const Axios = require('axios')
const message = require('./message/index')
const dayjs = require('dayjs')
const config = require('./config')

const axios = Axios.create({
    baseURL:'https://pbmapi.xiaoyanggroup.com/api/'
})
const pathList = {
    path1:'Project/GetMainProjects',
    path2:'WorkTime/GetWorkTimeTypes',
    path3:'WorkTime/BatchCreateMainProjectDayWorkTime'
}

init()
async function init(){
    
    const accountList = JSON.parse(config.account_list)

    // 接入接口坞的接口 判断当前是否是工作日 地址：http://www.apihubs.cn/#/holiday
  const isWorkDay =await axios.get(`https://api.apihubs.cn/holiday/get?field=workday&date=${dayjs(new Date()).format('YYYYMMDD')}&workday=1&cn=1&size=31`).then(res=>{
      return res.data.data.list.length >0
  })

  // 如果不是工作日，则不执行下面的语句
  if (!isWorkDay) return

  console.log('今天是工作日，需要填报晓羊PBM哦~');
 
    if(accountList.length>0){
        accountList.forEach(item=>{
            main(item)
        })
        
    }else{
        message.sendMail({
            email:'raingrains@foxmail.com',
            text:`
            晓羊PBM自动填写的github仓库需要配置account_list 格式为
    
            [
                {
                    leaderUserId:'领导的userId',
                    token:'自己的账号token', //8ab6d1d675cefc7dc39e86c7c02a4b65
                    workType:'代码开发', // 自己的工作类别
                    email:'消息提醒的邮箱账号'
                }
            ]
            `
        })
    }
    
}



 async function main(user){
    
    const state = {
        selfProjectList:[],
        workTypeList:[]
    }
   const taskList = await  axios.get(pathList.path1,{
        params:{
            AscOrderById:false,
            page:1,
            SearchKey:'',
            status:'',
            ProjectType:""
        },
        headers:{
            xytoken:user.token
        }
    }).then(res=>{
        return res.data.data.data
    }).catch((err)=>{
        message.sendMail({
            email:user.email,
            text: err
        })
//         if(err){
//             message.sendMail({
//                 email:user.email,
//                 text: 'token信息已过期,请重新登陆'
//             })
//         }else{
//             message.sendMail({
//                 email:user.email,
//                 text: err
//             })
//         }
        return false
    })
    


    if (!taskList) {
        return
    }

    state.selfProjectList = taskList.filter(item=>item.ProjectDirectorUserId===user.leaderUserId&&item.ProjectStatus===1)

    // 获取工作类别的列表数据
    state.workTypeList  = await axios.get(pathList.path2,{
        params:{
            projectId:state.selfProjectList[0].ProjectId
        },
        headers:{
            xytoken:user.token
        }
    }).then(res=>{
        return res.data.data.find(item=>item.FunctionName==="产品研发部").Items
    })

    const taskCompleteObj = {
        ProjectId:state.selfProjectList[0].ProjectId,
        WorkTimeTypeName:user.workType,
        fillInTime:8,
        key: "",
        workDes: "",
        workType: state.workTypeList.find(item=>item.WorkTimeTypeName===user.workType).WorkTimeTypeId
    }
    
    // 提交PBM传参
    const data = {
        fillInDateTime: dayjs(new Date()).format('YYYY-MM-DD'),
        items:[taskCompleteObj],
        remarks:''
    }


    // 填报成功的消息提示
    const tipsText  = `
        您今日的项目【${state.selfProjectList[0].ProjectName}】的工时类别【${taskCompleteObj.WorkTimeTypeName}】已进行8小时的填报
    `
    console.log(tipsText);

    axios.post(pathList.path3,data,{
        headers:{
            xytoken:user.token
        }
    }).then(res=>{
        console.log(res.data);
        if(res.data.data===0){
            message.sendMail({
                email:user.email,
                text:  res.data.msg
            })
        }else{
            message.sendMail({
                email:user.email,
                text:  tipsText
            })
        }
    })
}
