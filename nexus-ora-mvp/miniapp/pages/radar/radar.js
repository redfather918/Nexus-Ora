const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/fortune').then(r=>this.setData({result:r}))
}})