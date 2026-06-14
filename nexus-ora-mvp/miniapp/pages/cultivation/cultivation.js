const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/cultivation/today').then(r=>this.setData({result:r}))
}})