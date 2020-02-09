var http = require('http')
var fs = require('fs')
var url = require('url')
var port = process.argv[2]
var md5 = require('md5');
 

if(!port){
  // console.log('请指定端口号好不啦？\nnode server.js 8888 这样不会吗？')
  process.exit(1)
}

let sessions = {

}

var server = http.createServer(function(request, response){
  var parsedUrl = url.parse(request.url, true)
  var pathWithQuery = request.url 
  var queryString = ''
  if(pathWithQuery.indexOf('?') >= 0){ queryString = pathWithQuery.substring(pathWithQuery.indexOf('?')) }
  var path = parsedUrl.pathname
  var query = parsedUrl.query
  var method = request.method

  // console.log('查询字符串的路径\n' + pathWithQuery)

  if(path === '/'){
    let string = fs.readFileSync('./index.html', 'utf8')
    let cookies = ''
    if(request.headers.cookie) {
      cookies =  request.headers.cookie.split('; ') // ['email=1@', 'a=1', 'b=2']
    }
    let hash = {}
    for(let i =0;i<cookies.length; i++){
      let parts = cookies[i].split('=')
      let key = parts[0]
      let value = parts[1]
      hash[key] = value 
    }
    let mySession = sessions[hash.sessionId]
    let email
    if(mySession){
      email = mySession.sign_in_email
    }
    let users = fs.readFileSync('./db/users', 'utf8')
    users = JSON.parse(users)
    let foundUser
    for(let i=0; i< users.length; i++){
      if(users[i].email === email){
        foundUser = users[i]
        break
      }
    }
    // console.log(`foundUser`)
    // console.log(foundUser)
    if(foundUser){
      string = string.replace('__password__', foundUser.password)
    }else{
      string = string.replace('__password__', '不知道')
    }
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  }else if(path === '/sign_up' && method === 'GET'){ 
    let string = fs.readFileSync('./sign_up.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  }else if(path === '/sign_up' && method === 'POST'){  //用户注册
    readBody(request).then((body)=>{
      let strings = body.split('&') // ['email=1', 'password=2', 'password_confirmation=3']
      let hash = {}
      strings.forEach((string)=>{
        // string == 'email=1'
        let parts = string.split('=') // ['email', '1']
        let key = parts[0]
        let value = parts[1]
        hash[key] = decodeURIComponent(value) // hash['email'] = '1'
      })
      let {email, password, password_confirmation} = hash
      //邮箱中没有@符号时，返回错误信息
      if(email.indexOf('@') === -1){
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json;charset=utf-8')
        response.write(`{
          "errors": {
            "email": "invalid"
          }
        }`)
      }else if(password !== password_confirmation){
        response.statusCode = 400
        response.write('password not match')
      }else{
        var users = fs.readFileSync('./db/users', 'utf8')
        try{
          users = JSON.parse(users) // 将字符串变成[]
        }catch(exception){
          users = []
        }
        let inUse = false
        for(let i=0; i<users.length; i++){
          let user = users[i]
          if(user.email === email){
            inUse = true
            break;
          }
        }
        if(inUse){
          response.statusCode = 400
          response.write('email in use')
        }else{
          users.push({email: email, password: password})
          var usersString = JSON.stringify(users)
          fs.writeFileSync('./db/users', usersString)
          response.statusCode = 200
        }
      }
      response.end()
    })
  }else if(path==='/sign_in' && method === 'GET'){
    let string = fs.readFileSync('./sign_in.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  }else if(path==='/sign_in' && method === 'POST'){   // 用户登录
    readBody(request).then((body)=>{
      let strings = body.split('&') // ['email=1', 'password=2', 'password_confirmation=3']
      let hash = {}
      strings.forEach((string)=>{
        // string == 'email=1'
        let parts = string.split('=') // ['email', '1']
        let key = parts[0]
        let value = parts[1]
        hash[key] = decodeURIComponent(value) // hash['email'] = '1'
      })
      let {email, password} = hash
      var users = fs.readFileSync('./db/users', 'utf8')
      try{
        users = JSON.parse(users) // []
      }catch(exception){
        users = []
      }
      let found
      for(let i=0;i<users.length; i++){
        if(users[i].email === email && users[i].password === password){
          found = true
          break
        }
      }
      if(found){
        //服务器设置sessionId通过cookie发送给客户端，session就是将cookie中设置的内容换成随机数而已，然后再传给客户端，此后客户端再次请求相同域名时都会带上这个sessionId，
        //服务器会根据这个sessionId在sessions这个内存中找对应的用户信息。
        let sessionId = Math.random() * 1000000
        sessions[sessionId] = {sign_in_email: email}
        response.setHeader('Set-Cookie', `sessionId=${sessionId}`)
        response.statusCode = 200
      }else{
        response.statusCode = 401
      }
      response.end()
    })
  }else if(path==='/main.js'){
    let string = fs.readFileSync('./main.js', 'utf8')
    // md5 信息摘要算法，一种被广泛使用的密码散列函数，可以产生出一个128位（16字节）的散列值（hash value），用于确保信息传输完整一致。
    //如果两个文件的MD5值一样，则表明两个文件相同，传输过程中没有出错。
    let fileMd5 = md5(string)
    response.setHeader('Content-Type', 'text/javascript;charset=utf-8')
    response.setHeader('ETag',fileMd5)
    // response.setHeader('Last-Modified',"Fri, 10 Jan 2020 01:19:17 GMT")
    // console.log(request.headers)
    console.log(`if-none-match`)
    console.log(request.headers['if-none-match'])
    console.log(`fileMd5`)
    console.log(fileMd5)
    if(request.headers['if-none-match'] !== fileMd5){
      response.statusCode = 200
      response.write(string)
    }else{
      response.statusCode = 304  //返回304，告诉浏览器直接使用缓存内容就行，该缓存内容仍然是新鲜的
    }
    response.end()
  }else if(path==='/main.css'){
    let string = fs.readFileSync('./main.css', 'utf8')
    response.setHeader('Content-Type', 'text/css;charset=utf-8')
    response.statusCode = 200
    // max-age字段为最大缓存周期
    response.setHeader('Cache-Control','max-age=3156000')   //注意缓存与ETag的区别
    // response.setHeader('Expires','Fri, 13 Dec 2019 11:07:50 GMT')  //Expires什么时候过期：按照的是用户本地的时间与所设置的时间相比较，万一用户本地时间发生了错乱，就会出现问题，不靠谱。
    response.write(string)
    response.end()
  }else{
    response.statusCode = 404
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(`
      {
        "error": "not found"
      }
    `)
    response.end()
  }

})

function readBody(request){
  return new Promise((resolve, reject)=>{
    let body = []
    request.on('data', (chunk) => {
      body.push(chunk);
    }).on('end', () => {
      body = Buffer.concat(body).toString();
      resolve(body)
    })
  })
}

server.listen(port)
console.log('监听 ' + port + ' 成功\n请打开 http://localhost:' + port)


