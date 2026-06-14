const app=getApp()
Page({data:{result:null},load(){
  app.request('/api/ziwei').then(r=>this.setData({result:r}))
}})