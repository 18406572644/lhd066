import fs from 'fs'
import FormData from 'form-data'
import http from 'http'

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJhZG1pbkBtb2NrdXAuc3R1ZGlvIiwicm9sZSI6ImFkbWluIiwiaWF0IjoxNzgxOTQ0NTUwLCJleHAiOjE3ODI1NDkzNTB9.mHOWzAWg_Yqs60BPD6AmFv_0OC5q1rafNcU2LZhnzvc'
const imagePath = 'D:/lhd066/uploads/templates/1781943839477-ad6a65e1ly1hio0mhczk3j21ha0tyk37.jpg'

const form = new FormData()
form.append('name', '测试质量检测模板')
form.append('category', 'poster')
form.append('description', '这是一个用于测试质量检测功能的模板，包含详细描述信息')
form.append('width', '2000')
form.append('height', '3000')
form.append('fit_x', '200')
form.append('fit_y', '300')
form.append('fit_width', '1600')
form.append('fit_height', '2400')
form.append('permission', 'public')
form.append('tags', JSON.stringify(['测试', '质量检测', '海报']))
form.append('image', fs.createReadStream(imagePath), { filename: 'test.jpg', contentType: 'image/jpeg' })

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/templates',
  method: 'POST',
  headers: {
    ...form.getHeaders(),
    'Authorization': `Bearer ${token}`,
  },
}

const req = http.request(options, (res) => {
  let data = ''
  res.on('data', (chunk) => data += chunk)
  res.on('end', () => {
    const result = JSON.parse(data)
    console.log('=== 模板创建结果 ===')
    console.log('success:', result.success)
    if (result.success) {
      console.log('template.id:', result.data.id)
      console.log('template.name:', result.data.name)
      console.log('template.quality_grade:', result.data.quality_grade)
      console.log('template.quality_score:', result.data.quality_score)
      console.log('has qualityReport:', !!result.data.qualityReport)
      if (result.data.qualityReport) {
        const qr = result.data.qualityReport
        console.log('--- 质量报告 ---')
        console.log('总分:', qr.totalScore, '/ 100')
        console.log('等级:', qr.grade)
        console.log('贴合区域:', qr.fitRegionScore)
        console.log('图片质量:', qr.imageQualityScore)
        console.log('元信息:', qr.metadataScore)
        console.log('可访问性:', qr.accessibilityScore)
        console.log('问题点数量:', qr.issues.length)
        qr.issues.forEach(i => console.log('  -', `[${i.severity}]`, i.message))
        console.log('建议数量:', qr.suggestions.length)
        qr.suggestions.forEach(s => console.log('  -', s.message))
        console.log('自动标签:', qr.autoTags.join(', '))
      }
    } else {
      console.log('error:', result.error)
    }
    process.exit(0)
  })
})

req.on('error', (e) => {
  console.error('Error:', e.message)
  process.exit(1)
})

form.pipe(req)
