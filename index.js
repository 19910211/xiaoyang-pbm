const axios = require('axios')
const message = require('./message/index')
const dayjs = require('dayjs')
const config = require('./config')

console.log(config.account_list)
const accountList = JSON.parse(config.account_list)
console.log(accountList)

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

 async function main(user){
    const state = {
        selfProjectList:[],
        workTypeList:[]
    }
   const taskList = await  axios.get("https://pbmapi.xiaoyanggroup.com/api/Project/GetMainProjects",{
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
        console.log(err.response);
        if(err.response.status === 401){
            message.sendMail({
                email:user.email,
                text: 'token信息已过期,请重新登陆'
            })
        }else{
            message.sendMail({
                email:user.email,
                text: err.response.statusText
            })
        }
        return false
    })


    if (!taskList) {
        return
    }

    state.selfProjectList = taskList.filter(item=>item.ProjectDirectorUserId===user.leaderUserId&&item.ProjectStatus===1)

    // 获取工作类别的列表数据
    state.workTypeList  = await axios.get('https://pbmapi.xiaoyanggroup.com/api/WorkTime/GetWorkTimeTypes',{
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

    console.log(111);
    return 


    // 填报成功的消息提示
    const tipsText  = `
        您今日的项目【${state.selfProjectList[0].ProjectName}】的工时类别【${taskCompleteObj.WorkTimeTypeName}】已进行8小时的填报
    `
    axios.post('https://pbmapi.xiaoyanggroup.com/api/WorkTime/BatchCreateMainProjectDayWorkTime',data,{
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
