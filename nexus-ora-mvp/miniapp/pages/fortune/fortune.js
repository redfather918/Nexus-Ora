const app = getApp()
Page({data:{birth:'',g:1,result:null,loading:false},onBirth(e){this.setData({birth:e.detail.value})},setG(e){this.setData({g:Number(e.currentTarget.dataset.g)})},doFortune(){if(!this.data.birth){wx.showToast({title:'请选择出生日期',icon:'none'});return}
this.setData({loading:true})
const d=this.data.birth
const g=this.data.g===1?'male':'female'
app.request('/api/fortune',{birth_date:d,gender:g},'POST').then(r=>{this.setData({result:r,loading:false})}).catch(()=>{wx.showToast({title:'请求失败',icon:'none'});this.setData({loading:false})})}})