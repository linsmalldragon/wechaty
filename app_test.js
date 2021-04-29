
const { Wechaty } = require('wechaty');

const name = 'wechat-puppet-wechat';
let bot = '';
bot = new Wechaty({
    name, // generate xxxx.memory-card.json and save login data for the next login
});


const data = {
    "greeting": "hi\n",
    "admin": "萌伢",
    "HELPER_CONTACT_NAME": "Small Dragon",
    "words": {
        "书法": "书法爱好者群",
        "国画": "国画爱好者群"
    }
}
//  二维码生成
function onScan(qrcode, status) {
    require('qrcode-terminal').generate(qrcode); // 在console端显示二维码
    const qrcodeImageUrl = [
        'https://wechaty.js.org/qrcode/',
        encodeURIComponent(qrcode),
    ].join('');
    console.log(qrcodeImageUrl);
}

// 登录
async function onLogin(user) {
    console.log(`贴心小助理${user}登录了`);
    //   if (config.AUTOREPLY) {
    //     console.log(`已开启机器人自动聊天模式`);
    //   }
    // 登陆后创建定时任务
    //   await initDay();
}

//登出
function onLogout(user) {
    console.log(`小助手${user} 已经登出`);
}

// 检查，限制只有机器人可以邀请
// 检查哪个群，把哪个群传递进来
async function checkRoomJoin(room, inviteeList, inviter) {
    const userSelf = bot.userSelf()
    if (inviter.id !== userSelf.id) {
        await room.say('只允许私下拉人',
            inviter,
        )
        await room.say('先将你移出群，如有需要，请加我微信进群',
            inviteeList,
        )
        setTimeout(
            _ => inviteeList.forEach(c => room.del(c)),
            10 * 1000,
        )
    } else {
        await room.say('欢迎新朋友~')
    }
}

// 邀请一人入群
async function putInRoom(contact, room) {
    try {
        // 这个添加人可能出现错误，例如人数满员了
        await room.add(contact)
        setTimeout(
            _ => room.say('Welcome ', contact),
            10 * 1000,
        )
    } catch (e) {
        log.error('putInRoom.err' + e.stack)
        // 尝试检查群的人数,如果人数满了,建新群重拉
        let members = await room.memberAll()
        if (members.length >= 500) {
            let nextGroupName = getNextGroupName(await room.topic())
            createAndManageRoom(contact, nextGroupName)
        }
    }
}

// 获取下一个可用的群名
function getNextGroupName(groupName) {
    let r = groupName
    let res = /\w(\d)?$/i.exec(groupName)
    if (res) {
        let n = parseInt(res[0])
        r = r.replace(`${n}`, n + 1)
    } else {
        r += `${1}`
    }
    return r
}

// 创建一个群
async function createRoom(contact, groupName) {
    // 三个人开始建群
    const helperContact = await bot.Contact.find({ name: data.HELPER_CONTACT_NAME })

    if (!helperContact) {
        await contact.say(`没有这个朋友："${helperContact.name()}",或者TA违规了，需要换一个人协助建群`)
        return
    }

    const contactList = [contact, helperContact]
    const room = await bot.Room.create(contactList, groupName)

    // 避免新建的群通过find找不到，在这里调用sync方法
    await room.sync()
    // await room.topic(groupName)
    await room.say(`${groupName} - created`)

    return room
}



// 创建与管理群
async function createAndManageRoom(from, groupName) {
    const groupReg = new RegExp(`^${groupName}$`, 'i')
    await createRoom(from, groupName)
    // await manageRoom(groupReg)
    const room = await bot.Room.find({ topic: groupReg })
    if (!room) {
        log.warn("没有找到群：", groupName)
        return
    }
    room.on('join', function (inviteeList, inviter) {
        console.log('有人加入群，此群群ID:', this.id)
        checkRoomJoin.call(this, room, inviteeList, inviter)
    })
    room.on('leave', (leaverList, remover) => {
        log.info("有人离开群了")
    })
    room.on('topic', (topic, oldTopic, changer) => {
        log.info("群名发生了更改")
    })
}
// 处理用户想加入群的需求
async function dealWithGroup(from, groupName, msg, requireCheckPayState = true) {
    const groupReg = new RegExp(`^${groupName}$`, 'i')
    const dingRoom = await bot.Room.find({ topic: groupReg })
    if (dingRoom) {
        if (await dingRoom.has(from)) {
            const topic = await dingRoom.topic()
            await dingRoom.say(`已在群内`, from)
            await from.say(`已经在群（"${topic}"）内，艾特你了`)
        } else {
            if (!requireCheckPayState || (requireCheckPayState && await payForGroup(msg, groupName))) {//支付完成，拉群
                await putInRoom(from, dingRoom)
            }
        }
    } else {
        if (!requireCheckPayState || (requireCheckPayState && await payForGroup(msg, groupName))) {//支付完成，拉群
            createAndManageRoom(from, groupName)
        }
    }
}

//收到消息
async function onMessage(msg) {
    const room = msg.room()
    const from = msg.talker()
    const text = msg.text()
    console.log('msg', text)

    if (!from || msg.self()) {
        return
    }

    // 
    if (await from.name() == data.admin) {
        if (/^更新$/i.test(text)) {
            const admin = await bot.Contact.find({ name: "程序员LIYI" })
            await admin.sync()
            return
        }
        if (/^退出$/i.test(text)) {
            await bot.logout()
            return
        }
    }

    // 踢出某人
    if (room) {
        // ok
        let execKickUserRes = /^@(.*)? 勿发$/i.exec(text)
        if (execKickUserRes) {
            let toUserName = execKickUserRes[1]
            // 只有机器人可以踢人
            if (from.name() == data.admin) {
                let toContact = await room.member({ name: new RegExp(`^${toUserName}$`, 'i') })
                await room.del(toContact)
                room.say(`已将${toContact.name()}移出`)
            }
        }
        return
    }

    // 用户主动申请加群
    let getWorkRes = /^申请加入([\u4E00-\u9FA5]{2,4})?群$/i.exec(text)
    if (getWorkRes) {
        let word = getWorkRes[1]//书法
        let groupName = data.words[word]
        if (groupName) {
            dealWithGroup(from, groupName, msg,false)
        }
        return
    }

    // #查询 xxx
    // 用户主动查询支付过的订单
    // let userQueryPayerRes = /^#查询(\d{4}\w+)?$/i.exec(text)
    // if (userQueryPayerRes) {
    //     let out_trade_no = userQueryPayerRes[1]
    //     const usersData = util.readFile('./user.json')
    //     let userDataObject = usersData[out_trade_no]
    //     if (userDataObject) {
    //         userQueryOldOrder(msg, userDataObject)
    //     }
    //     return
    // }
    // 
}

bot.on('scan', onScan);
bot.on('login', onLogin);
bot.on('logout', onLogout);
bot.on('message', onMessage)
bot
    .start()
    .then(() => console.log('开始登陆微信'))
    .catch((e) => console.error(e));