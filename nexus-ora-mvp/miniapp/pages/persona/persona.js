const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/persona/generate').then(r=>this.setData({result:r}))
}})