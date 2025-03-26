import DB from '../lib/db.js';
import { appListGen } from './command/menu.js'

export async function addApp(conversation, ctx) {
  await ctx.reply('Send me the name of the application');
  let appName = await conversation.wait();
  if (!appName.message?.text) {
    do {
      await ctx.reply('Application name must be text')
      appName = await conversation.wait();
    } while (!appName.message?.text)
  }
  await ctx.reply('Now send me a token of your app')
  let appToken = await conversation.wait();
  if (!appToken.message?.text || appToken.message?.text.includes('1')) {
    do {
      await ctx.reply('Not a token, try again');
      appToken = await conversation.wait();
    } while (!appToken.message?.text || appToken.message?.text.includes('1'));
  }
  await DB.regNewApp(ctx.chat.id, appName.msg.text, appToken.msg.text.split(/\s+/).join(''))
  await ctx.reply('List of your apps', { reply_markup: await appListGen(ctx) })
}
