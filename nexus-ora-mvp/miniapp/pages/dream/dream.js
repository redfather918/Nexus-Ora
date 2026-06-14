const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/dreams').then(r=>this.setData({result:r}))
}})