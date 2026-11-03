import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'verify_email.notice': { paramsTuple?: []; params?: {} }
    'verify_email.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'verify_email.resend': { paramsTuple?: []; params?: {} }
    'forgot_password.create': { paramsTuple?: []; params?: {} }
    'forgot_password.store': { paramsTuple?: []; params?: {} }
    'reset_password.create': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'reset_password.store': { paramsTuple?: []; params?: {} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'conversations.index': { paramsTuple?: []; params?: {} }
    'conversations.create': { paramsTuple?: []; params?: {} }
    'conversations.list': { paramsTuple?: []; params?: {} }
    'conversations.users': { paramsTuple?: []; params?: {} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'messageId': ParamValue} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'messageId': ParamValue} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'verify_email.notice': { paramsTuple?: []; params?: {} }
    'verify_email.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'forgot_password.create': { paramsTuple?: []; params?: {} }
    'reset_password.create': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'conversations.index': { paramsTuple?: []; params?: {} }
    'conversations.create': { paramsTuple?: []; params?: {} }
    'conversations.list': { paramsTuple?: []; params?: {} }
    'conversations.users': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'messageId': ParamValue} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'dashboard': { paramsTuple?: []; params?: {} }
    'verify_email.notice': { paramsTuple?: []; params?: {} }
    'verify_email.show': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'forgot_password.create': { paramsTuple?: []; params?: {} }
    'reset_password.create': { paramsTuple: [ParamValue]; params: {'token': ParamValue} }
    'event_stream': { paramsTuple?: []; params?: {} }
    'conversations.index': { paramsTuple?: []; params?: {} }
    'conversations.create': { paramsTuple?: []; params?: {} }
    'conversations.list': { paramsTuple?: []; params?: {} }
    'conversations.users': { paramsTuple?: []; params?: {} }
    'conversations.show': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.show': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'messageId': ParamValue} }
  }
  POST: {
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'verify_email.resend': { paramsTuple?: []; params?: {} }
    'forgot_password.store': { paramsTuple?: []; params?: {} }
    'reset_password.store': { paramsTuple?: []; params?: {} }
    'subscribe': { paramsTuple?: []; params?: {} }
    'unsubscribe': { paramsTuple?: []; params?: {} }
    'conversations.store': { paramsTuple?: []; params?: {} }
    'messages.store': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'messages.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'id': ParamValue,'messageId': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}