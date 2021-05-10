import { Contact, log, Message, ScanStatus, Wechaty } from "wechaty";
import { PuppetPadlocal } from "wechaty-puppet-padlocal";

const puppet = new PuppetPadlocal({
    token: "puppet_padlocal_dbfdea27ac8e4c938c5dab45913728d9" // 输入你的token.
})
const HELPER_CONTACT_NAME='Small Dragon';
const ADMIN='小龙';
const bot = new Wechaty({
    name: "TestBot",
    puppet,
})

    .on("scan", (qrcode: string, status: ScanStatus) => {
        if (status === ScanStatus.Waiting && qrcode) {
            const qrcodeImageUrl = [
                'https://wechaty.js.org/qrcode/',
                encodeURIComponent(qrcode),
            ].join('')

            log.info("TestBot", `onScan: ${ScanStatus[status]}(${status}) - ${qrcodeImageUrl}`);

            require('qrcode-terminal').generate(qrcode, { small: true })  // show qrcode on console
        } else {
            log.info("TestBot", `onScan: ${ScanStatus[status]}(${status})`);
        }
    })

    .on("login", (user: Contact) => {
        log.info("TestBot", `${user} login`);
    })

    .on("logout", (user: Contact, reason: string) => {
        log.info("TestBot", `${user} logout, reason: ${reason}`);
    })

    .on("message", async (message: Message) => {
        if (message.text().toString().includes("价格")) {  // 这里的反应前缀可以根据需求修改
            log.info(message.text().toString()); // 打印一下反应的Text.
            const s1 = message.text().toString().split("价格")[0];
            let result = await coinBot(s1);
            const member = message.talker();
            const to = message.to();
            let sendUser;
            if(member.name()===ADMIN){
                sendUser=to;
            }else{
                sendUser=member;
            }
            if (result != null) {
                if (message.room()) {
                    message.room().say("\n" + result, member);
                } else {
                    
                    sendUser.say("\n" + result);
                }
            }
            else {
                log.info(message.toString());
                if (message.room()) {
                    message.room().say("\n" + "没这币", member);
                } else {
                    sendUser.say("\n" + "没这币");
                }

            }
        };
    })

    .on("error", (error) => {
        log.error("TestBot", 'on error: ', error.stack);
    })

bot.start().then(() => {
    log.info("TestBot", "started.");
});

async function coinBot(s1) {
    var result;
    const rp = require('request-promise');
    const requestOptions = {
        method: 'GET',
        uri: 'https://fxhapi.feixiaohao.com/public/v1/ticker', // 这里使用的非小号的API
        qs: {
            'start': '0',
            'limit': '5000',  //非小号最高数据5000
            'convert': 'USD'
        },
        json: true,
        gzip: true
    };

    let response = await rp(requestOptions);
    for (var each in response) {
        if (response[each]["symbol"].toLowerCase() == s1) {
            result = "[币种]: " + response[each]["symbol"] + `\n` + "[价格]: " + response[each]["price_usd"] + '\n' + "[24小时涨幅]: " + response[each]["percent_change_24h"] + "%";
            break;
        }
    }
    return result;
}