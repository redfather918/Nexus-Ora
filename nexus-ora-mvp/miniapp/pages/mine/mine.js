const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/health').then(r=>this.setData({result:r}))
}})