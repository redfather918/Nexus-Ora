const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/divination/daily').then(r=>this.setData({result:r}))
}})