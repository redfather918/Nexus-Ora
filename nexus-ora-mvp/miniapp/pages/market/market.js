const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/market/digital').then(r=>this.setData({result:r}))
}})