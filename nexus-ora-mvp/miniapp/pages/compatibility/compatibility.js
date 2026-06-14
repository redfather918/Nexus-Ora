const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/compatibility').then(r=>this.setData({result:r}))
}})