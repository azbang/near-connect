var Et=Object.defineProperty;var Ct=(J,H,Q)=>H in J?Et(J,H,{enumerable:!0,configurable:!0,writable:!0,value:Q}):J[H]=Q;var j=(J,H,Q)=>Ct(J,typeof H!="symbol"?H+"":H,Q);(function(){"use strict";function J(L){return L&&L.__esModule&&Object.prototype.hasOwnProperty.call(L,"default")?L.default:L}var H={exports:{}};(function(L,_){var b=function(){var m=function(p,d){var u=236,g=17,n=p,h=k[d],e=null,t=0,v=null,f=[],l={},T=function(a,o){t=n*4+17,e=function(r){for(var i=new Array(r),s=0;s<r;s+=1){i[s]=new Array(r);for(var c=0;c<r;c+=1)i[s][c]=null}return i}(t),B(0,0),B(t-7,0),B(0,t-7),P(),R(),q(a,o),n>=7&&U(a),v==null&&(v=Mt(n,h,f)),$(v,o)},B=function(a,o){for(var r=-1;r<=7;r+=1)if(!(a+r<=-1||t<=a+r))for(var i=-1;i<=7;i+=1)o+i<=-1||t<=o+i||(0<=r&&r<=6&&(i==0||i==6)||0<=i&&i<=6&&(r==0||r==6)||2<=r&&r<=4&&2<=i&&i<=4?e[a+r][o+i]=!0:e[a+r][o+i]=!1)},E=function(){for(var a=0,o=0,r=0;r<8;r+=1){T(!0,r);var i=I.getLostPoint(l);(r==0||a>i)&&(a=i,o=r)}return o},R=function(){for(var a=8;a<t-8;a+=1)e[a][6]==null&&(e[a][6]=a%2==0);for(var o=8;o<t-8;o+=1)e[6][o]==null&&(e[6][o]=o%2==0)},P=function(){for(var a=I.getPatternPosition(n),o=0;o<a.length;o+=1)for(var r=0;r<a.length;r+=1){var i=a[o],s=a[r];if(e[i][s]==null)for(var c=-2;c<=2;c+=1)for(var x=-2;x<=2;x+=1)c==-2||c==2||x==-2||x==2||c==0&&x==0?e[i+c][s+x]=!0:e[i+c][s+x]=!1}},U=function(a){for(var o=I.getBCHTypeNumber(n),r=0;r<18;r+=1){var i=!a&&(o>>r&1)==1;e[Math.floor(r/3)][r%3+t-8-3]=i}for(var r=0;r<18;r+=1){var i=!a&&(o>>r&1)==1;e[r%3+t-8-3][Math.floor(r/3)]=i}},q=function(a,o){for(var r=h<<3|o,i=I.getBCHTypeInfo(r),s=0;s<15;s+=1){var c=!a&&(i>>s&1)==1;s<6?e[s][8]=c:s<8?e[s+1][8]=c:e[t-15+s][8]=c}for(var s=0;s<15;s+=1){var c=!a&&(i>>s&1)==1;s<8?e[8][t-s-1]=c:s<9?e[8][15-s-1+1]=c:e[8][15-s-1]=c}e[t-8][8]=!a},$=function(a,o){for(var r=-1,i=t-1,s=7,c=0,x=I.getMaskFunction(o),w=t-1;w>0;w-=2)for(w==6&&(w-=1);;){for(var D=0;D<2;D+=1)if(e[i][w-D]==null){var O=!1;c<a.length&&(O=(a[c]>>>s&1)==1);var y=x(i,w-D);y&&(O=!O),e[i][w-D]=O,s-=1,s==-1&&(c+=1,s=7)}if(i+=r,i<0||t<=i){i-=r,r=-r;break}}},W=function(a,o){for(var r=0,i=0,s=0,c=new Array(o.length),x=new Array(o.length),w=0;w<o.length;w+=1){var D=o[w].dataCount,O=o[w].totalCount-D;i=Math.max(i,D),s=Math.max(s,O),c[w]=new Array(D);for(var y=0;y<c[w].length;y+=1)c[w][y]=255&a.getBuffer()[y+r];r+=D;var N=I.getErrorCorrectPolynomial(O),S=F(c[w],N.getLength()-1),at=S.mod(N);x[w]=new Array(N.getLength()-1);for(var y=0;y<x[w].length;y+=1){var ot=y+at.getLength()-x[w].length;x[w][y]=ot>=0?at.getAt(ot):0}}for(var it=0,y=0;y<o.length;y+=1)it+=o[y].totalCount;for(var tt=new Array(it),V=0,y=0;y<i;y+=1)for(var w=0;w<o.length;w+=1)y<c[w].length&&(tt[V]=c[w][y],V+=1);for(var y=0;y<s;y+=1)for(var w=0;w<o.length;w+=1)y<x[w].length&&(tt[V]=x[w][y],V+=1);return tt},Mt=function(a,o,r){for(var i=G.getRSBlocks(a,o),s=Z(),c=0;c<r.length;c+=1){var x=r[c];s.put(x.getMode(),4),s.put(x.getLength(),I.getLengthInBits(x.getMode(),a)),x.write(s)}for(var w=0,c=0;c<i.length;c+=1)w+=i[c].dataCount;if(s.getLengthInBits()>w*8)throw"code length overflow. ("+s.getLengthInBits()+">"+w*8+")";for(s.getLengthInBits()+4<=w*8&&s.put(0,4);s.getLengthInBits()%8!=0;)s.putBit(!1);for(;!(s.getLengthInBits()>=w*8||(s.put(u,8),s.getLengthInBits()>=w*8));)s.put(g,8);return W(s,i)};l.addData=function(a,o){o=o||"Byte";var r=null;switch(o){case"Numeric":r=z(a);break;case"Alphanumeric":r=yt(a);break;case"Byte":r=bt(a);break;case"Kanji":r=mt(a);break;default:throw"mode:"+o}f.push(r),v=null},l.isDark=function(a,o){if(a<0||t<=a||o<0||t<=o)throw a+","+o;return e[a][o]},l.getModuleCount=function(){return t},l.make=function(){if(n<1){for(var a=1;a<40;a++){for(var o=G.getRSBlocks(a,h),r=Z(),i=0;i<f.length;i++){var s=f[i];r.put(s.getMode(),4),r.put(s.getLength(),I.getLengthInBits(s.getMode(),a)),s.write(r)}for(var c=0,i=0;i<o.length;i++)c+=o[i].dataCount;if(r.getLengthInBits()<=c*8)break}n=a}T(!1,E())},l.createTableTag=function(a,o){a=a||2,o=typeof o>"u"?a*4:o;var r="";r+='<table style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: "+o+"px;",r+='">',r+="<tbody>";for(var i=0;i<l.getModuleCount();i+=1){r+="<tr>";for(var s=0;s<l.getModuleCount();s+=1)r+='<td style="',r+=" border-width: 0px; border-style: none;",r+=" border-collapse: collapse;",r+=" padding: 0px; margin: 0px;",r+=" width: "+a+"px;",r+=" height: "+a+"px;",r+=" background-color: ",r+=l.isDark(i,s)?"#000000":"#ffffff",r+=";",r+='"/>';r+="</tr>"}return r+="</tbody>",r+="</table>",r},l.createSvgTag=function(a,o,r,i){var s={};typeof arguments[0]=="object"&&(s=arguments[0],a=s.cellSize,o=s.margin,r=s.alt,i=s.title),a=a||2,o=typeof o>"u"?a*4:o,r=typeof r=="string"?{text:r}:r||{},r.text=r.text||null,r.id=r.text?r.id||"qrcode-description":null,i=typeof i=="string"?{text:i}:i||{},i.text=i.text||null,i.id=i.text?i.id||"qrcode-title":null;var c=l.getModuleCount()*a+o*2,x,w,D,O,y="",N;for(N="l"+a+",0 0,"+a+" -"+a+",0 0,-"+a+"z ",y+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',y+=s.scalable?"":' width="'+c+'px" height="'+c+'px"',y+=' viewBox="0 0 '+c+" "+c+'" ',y+=' preserveAspectRatio="xMinYMin meet"',y+=i.text||r.text?' role="img" aria-labelledby="'+Y([i.id,r.id].join(" ").trim())+'"':"",y+=">",y+=i.text?'<title id="'+Y(i.id)+'">'+Y(i.text)+"</title>":"",y+=r.text?'<description id="'+Y(r.id)+'">'+Y(r.text)+"</description>":"",y+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',y+='<path d="',D=0;D<l.getModuleCount();D+=1)for(O=D*a+o,x=0;x<l.getModuleCount();x+=1)l.isDark(D,x)&&(w=x*a+o,y+="M"+w+","+O+N);return y+='" stroke="transparent" fill="black"/>',y+="</svg>",y},l.createDataURL=function(a,o){a=a||2,o=typeof o>"u"?a*4:o;var r=l.getModuleCount()*a+o*2,i=o,s=r-o;return Bt(r,r,function(c,x){if(i<=c&&c<s&&i<=x&&x<s){var w=Math.floor((c-i)/a),D=Math.floor((x-i)/a);return l.isDark(D,w)?0:1}else return 1})},l.createImgTag=function(a,o,r){a=a||2,o=typeof o>"u"?a*4:o;var i=l.getModuleCount()*a+o*2,s="";return s+="<img",s+=' src="',s+=l.createDataURL(a,o),s+='"',s+=' width="',s+=i,s+='"',s+=' height="',s+=i,s+='"',r&&(s+=' alt="',s+=Y(r),s+='"'),s+="/>",s};var Y=function(a){for(var o="",r=0;r<a.length;r+=1){var i=a.charAt(r);switch(i){case"<":o+="&lt;";break;case">":o+="&gt;";break;case"&":o+="&amp;";break;case'"':o+="&quot;";break;default:o+=i;break}}return o},_t=function(a){var o=1;a=typeof a>"u"?o*2:a;var r=l.getModuleCount()*o+a*2,i=a,s=r-a,c,x,w,D,O,y={"██":"█","█ ":"▀"," █":"▄","  ":" "},N={"██":"▀","█ ":"▀"," █":" ","  ":" "},S="";for(c=0;c<r;c+=2){for(w=Math.floor((c-i)/o),D=Math.floor((c+1-i)/o),x=0;x<r;x+=1)O="█",i<=x&&x<s&&i<=c&&c<s&&l.isDark(w,Math.floor((x-i)/o))&&(O=" "),i<=x&&x<s&&i<=c+1&&c+1<s&&l.isDark(D,Math.floor((x-i)/o))?O+=" ":O+="█",S+=a<1&&c+1>=s?N[O]:y[O];S+=`
`}return r%2&&a>0?S.substring(0,S.length-r-1)+Array(r+1).join("▀"):S.substring(0,S.length-1)};return l.createASCII=function(a,o){if(a=a||1,a<2)return _t(o);a-=1,o=typeof o>"u"?a*2:o;var r=l.getModuleCount()*a+o*2,i=o,s=r-o,c,x,w,D,O=Array(a+1).join("██"),y=Array(a+1).join("  "),N="",S="";for(c=0;c<r;c+=1){for(w=Math.floor((c-i)/a),S="",x=0;x<r;x+=1)D=1,i<=x&&x<s&&i<=c&&c<s&&l.isDark(w,Math.floor((x-i)/a))&&(D=0),S+=D?O:y;for(w=0;w<a;w+=1)N+=S+`
`}return N.substring(0,N.length-1)},l.renderTo2dContext=function(a,o){o=o||2;for(var r=l.getModuleCount(),i=0;i<r;i++)for(var s=0;s<r;s++)a.fillStyle=l.isDark(i,s)?"black":"white",a.fillRect(i*o,s*o,o,o)},l};m.stringToBytesFuncs={default:function(p){for(var d=[],u=0;u<p.length;u+=1){var g=p.charCodeAt(u);d.push(g&255)}return d}},m.stringToBytes=m.stringToBytesFuncs.default,m.createStringToBytes=function(p,d){var u=function(){for(var n=kt(p),h=function(){var R=n.read();if(R==-1)throw"eof";return R},e=0,t={};;){var v=n.read();if(v==-1)break;var f=h(),l=h(),T=h(),B=String.fromCharCode(v<<8|f),E=l<<8|T;t[B]=E,e+=1}if(e!=d)throw e+" != "+d;return t}(),g=63;return function(n){for(var h=[],e=0;e<n.length;e+=1){var t=n.charCodeAt(e);if(t<128)h.push(t);else{var v=u[n.charAt(e)];typeof v=="number"?(v&255)==v?h.push(v):(h.push(v>>>8),h.push(v&255)):h.push(g)}}return h}};var A={MODE_NUMBER:1,MODE_ALPHA_NUM:2,MODE_8BIT_BYTE:4,MODE_KANJI:8},k={L:1,M:0,Q:3,H:2},C={PATTERN000:0,PATTERN001:1,PATTERN010:2,PATTERN011:3,PATTERN100:4,PATTERN101:5,PATTERN110:6,PATTERN111:7},I=function(){var p=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],d=1335,u=7973,g=21522,n={},h=function(e){for(var t=0;e!=0;)t+=1,e>>>=1;return t};return n.getBCHTypeInfo=function(e){for(var t=e<<10;h(t)-h(d)>=0;)t^=d<<h(t)-h(d);return(e<<10|t)^g},n.getBCHTypeNumber=function(e){for(var t=e<<12;h(t)-h(u)>=0;)t^=u<<h(t)-h(u);return e<<12|t},n.getPatternPosition=function(e){return p[e-1]},n.getMaskFunction=function(e){switch(e){case C.PATTERN000:return function(t,v){return(t+v)%2==0};case C.PATTERN001:return function(t,v){return t%2==0};case C.PATTERN010:return function(t,v){return v%3==0};case C.PATTERN011:return function(t,v){return(t+v)%3==0};case C.PATTERN100:return function(t,v){return(Math.floor(t/2)+Math.floor(v/3))%2==0};case C.PATTERN101:return function(t,v){return t*v%2+t*v%3==0};case C.PATTERN110:return function(t,v){return(t*v%2+t*v%3)%2==0};case C.PATTERN111:return function(t,v){return(t*v%3+(t+v)%2)%2==0};default:throw"bad maskPattern:"+e}},n.getErrorCorrectPolynomial=function(e){for(var t=F([1],0),v=0;v<e;v+=1)t=t.multiply(F([1,M.gexp(v)],0));return t},n.getLengthInBits=function(e,t){if(1<=t&&t<10)switch(e){case A.MODE_NUMBER:return 10;case A.MODE_ALPHA_NUM:return 9;case A.MODE_8BIT_BYTE:return 8;case A.MODE_KANJI:return 8;default:throw"mode:"+e}else if(t<27)switch(e){case A.MODE_NUMBER:return 12;case A.MODE_ALPHA_NUM:return 11;case A.MODE_8BIT_BYTE:return 16;case A.MODE_KANJI:return 10;default:throw"mode:"+e}else if(t<41)switch(e){case A.MODE_NUMBER:return 14;case A.MODE_ALPHA_NUM:return 13;case A.MODE_8BIT_BYTE:return 16;case A.MODE_KANJI:return 12;default:throw"mode:"+e}else throw"type:"+t},n.getLostPoint=function(e){for(var t=e.getModuleCount(),v=0,f=0;f<t;f+=1)for(var l=0;l<t;l+=1){for(var T=0,B=e.isDark(f,l),E=-1;E<=1;E+=1)if(!(f+E<0||t<=f+E))for(var R=-1;R<=1;R+=1)l+R<0||t<=l+R||E==0&&R==0||B==e.isDark(f+E,l+R)&&(T+=1);T>5&&(v+=3+T-5)}for(var f=0;f<t-1;f+=1)for(var l=0;l<t-1;l+=1){var P=0;e.isDark(f,l)&&(P+=1),e.isDark(f+1,l)&&(P+=1),e.isDark(f,l+1)&&(P+=1),e.isDark(f+1,l+1)&&(P+=1),(P==0||P==4)&&(v+=3)}for(var f=0;f<t;f+=1)for(var l=0;l<t-6;l+=1)e.isDark(f,l)&&!e.isDark(f,l+1)&&e.isDark(f,l+2)&&e.isDark(f,l+3)&&e.isDark(f,l+4)&&!e.isDark(f,l+5)&&e.isDark(f,l+6)&&(v+=40);for(var l=0;l<t;l+=1)for(var f=0;f<t-6;f+=1)e.isDark(f,l)&&!e.isDark(f+1,l)&&e.isDark(f+2,l)&&e.isDark(f+3,l)&&e.isDark(f+4,l)&&!e.isDark(f+5,l)&&e.isDark(f+6,l)&&(v+=40);for(var U=0,l=0;l<t;l+=1)for(var f=0;f<t;f+=1)e.isDark(f,l)&&(U+=1);var q=Math.abs(100*U/t/t-50)/5;return v+=q*10,v},n}(),M=function(){for(var p=new Array(256),d=new Array(256),u=0;u<8;u+=1)p[u]=1<<u;for(var u=8;u<256;u+=1)p[u]=p[u-4]^p[u-5]^p[u-6]^p[u-8];for(var u=0;u<255;u+=1)d[p[u]]=u;var g={};return g.glog=function(n){if(n<1)throw"glog("+n+")";return d[n]},g.gexp=function(n){for(;n<0;)n+=255;for(;n>=256;)n-=255;return p[n]},g}();function F(p,d){if(typeof p.length>"u")throw p.length+"/"+d;var u=function(){for(var n=0;n<p.length&&p[n]==0;)n+=1;for(var h=new Array(p.length-n+d),e=0;e<p.length-n;e+=1)h[e]=p[e+n];return h}(),g={};return g.getAt=function(n){return u[n]},g.getLength=function(){return u.length},g.multiply=function(n){for(var h=new Array(g.getLength()+n.getLength()-1),e=0;e<g.getLength();e+=1)for(var t=0;t<n.getLength();t+=1)h[e+t]^=M.gexp(M.glog(g.getAt(e))+M.glog(n.getAt(t)));return F(h,0)},g.mod=function(n){if(g.getLength()-n.getLength()<0)return g;for(var h=M.glog(g.getAt(0))-M.glog(n.getAt(0)),e=new Array(g.getLength()),t=0;t<g.getLength();t+=1)e[t]=g.getAt(t);for(var t=0;t<n.getLength();t+=1)e[t]^=M.gexp(M.glog(n.getAt(t))+h);return F(e,0).mod(n)},g}var G=function(){var p=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],d=function(n,h){var e={};return e.totalCount=n,e.dataCount=h,e},u={},g=function(n,h){switch(h){case k.L:return p[(n-1)*4+0];case k.M:return p[(n-1)*4+1];case k.Q:return p[(n-1)*4+2];case k.H:return p[(n-1)*4+3];default:return}};return u.getRSBlocks=function(n,h){var e=g(n,h);if(typeof e>"u")throw"bad rs block @ typeNumber:"+n+"/errorCorrectionLevel:"+h;for(var t=e.length/3,v=[],f=0;f<t;f+=1)for(var l=e[f*3+0],T=e[f*3+1],B=e[f*3+2],E=0;E<l;E+=1)v.push(d(T,B));return v},u}(),Z=function(){var p=[],d=0,u={};return u.getBuffer=function(){return p},u.getAt=function(g){var n=Math.floor(g/8);return(p[n]>>>7-g%8&1)==1},u.put=function(g,n){for(var h=0;h<n;h+=1)u.putBit((g>>>n-h-1&1)==1)},u.getLengthInBits=function(){return d},u.putBit=function(g){var n=Math.floor(d/8);p.length<=n&&p.push(0),g&&(p[n]|=128>>>d%8),d+=1},u},z=function(p){var d=A.MODE_NUMBER,u=p,g={};g.getMode=function(){return d},g.getLength=function(e){return u.length},g.write=function(e){for(var t=u,v=0;v+2<t.length;)e.put(n(t.substring(v,v+3)),10),v+=3;v<t.length&&(t.length-v==1?e.put(n(t.substring(v,v+1)),4):t.length-v==2&&e.put(n(t.substring(v,v+2)),7))};var n=function(e){for(var t=0,v=0;v<e.length;v+=1)t=t*10+h(e.charAt(v));return t},h=function(e){if("0"<=e&&e<="9")return e.charCodeAt(0)-48;throw"illegal char :"+e};return g},yt=function(p){var d=A.MODE_ALPHA_NUM,u=p,g={};g.getMode=function(){return d},g.getLength=function(h){return u.length},g.write=function(h){for(var e=u,t=0;t+1<e.length;)h.put(n(e.charAt(t))*45+n(e.charAt(t+1)),11),t+=2;t<e.length&&h.put(n(e.charAt(t)),6)};var n=function(h){if("0"<=h&&h<="9")return h.charCodeAt(0)-48;if("A"<=h&&h<="Z")return h.charCodeAt(0)-65+10;switch(h){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+h}};return g},bt=function(p){var d=A.MODE_8BIT_BYTE,u=m.stringToBytes(p),g={};return g.getMode=function(){return d},g.getLength=function(n){return u.length},g.write=function(n){for(var h=0;h<u.length;h+=1)n.put(u[h],8)},g},mt=function(p){var d=A.MODE_KANJI,u=m.stringToBytesFuncs.SJIS;if(!u)throw"sjis not supported.";(function(h,e){var t=u(h);if(t.length!=2||(t[0]<<8|t[1])!=e)throw"sjis not supported."})("友",38726);var g=u(p),n={};return n.getMode=function(){return d},n.getLength=function(h){return~~(g.length/2)},n.write=function(h){for(var e=g,t=0;t+1<e.length;){var v=(255&e[t])<<8|255&e[t+1];if(33088<=v&&v<=40956)v-=33088;else if(57408<=v&&v<=60351)v-=49472;else throw"illegal char at "+(t+1)+"/"+v;v=(v>>>8&255)*192+(v&255),h.put(v,13),t+=2}if(t<e.length)throw"illegal char at "+(t+1)},n},nt=function(){var p=[],d={};return d.writeByte=function(u){p.push(u&255)},d.writeShort=function(u){d.writeByte(u),d.writeByte(u>>>8)},d.writeBytes=function(u,g,n){g=g||0,n=n||u.length;for(var h=0;h<n;h+=1)d.writeByte(u[h+g])},d.writeString=function(u){for(var g=0;g<u.length;g+=1)d.writeByte(u.charCodeAt(g))},d.toByteArray=function(){return p},d.toString=function(){var u="";u+="[";for(var g=0;g<p.length;g+=1)g>0&&(u+=","),u+=p[g];return u+="]",u},d},At=function(){var p=0,d=0,u=0,g="",n={},h=function(t){g+=String.fromCharCode(e(t&63))},e=function(t){if(!(t<0)){if(t<26)return 65+t;if(t<52)return 97+(t-26);if(t<62)return 48+(t-52);if(t==62)return 43;if(t==63)return 47}throw"n:"+t};return n.writeByte=function(t){for(p=p<<8|t&255,d+=8,u+=1;d>=6;)h(p>>>d-6),d-=6},n.flush=function(){if(d>0&&(h(p<<6-d),p=0,d=0),u%3!=0)for(var t=3-u%3,v=0;v<t;v+=1)g+="="},n.toString=function(){return g},n},kt=function(p){var d=p,u=0,g=0,n=0,h={};h.read=function(){for(;n<8;){if(u>=d.length){if(n==0)return-1;throw"unexpected end of file./"+n}var t=d.charAt(u);if(u+=1,t=="=")return n=0,-1;if(t.match(/^\s$/))continue;g=g<<6|e(t.charCodeAt(0)),n+=6}var v=g>>>n-8&255;return n-=8,v};var e=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(t==43)return 62;if(t==47)return 63;throw"c:"+t};return h},Tt=function(p,d){var u=p,g=d,n=new Array(p*d),h={};h.setPixel=function(f,l,T){n[l*u+f]=T},h.write=function(f){f.writeString("GIF87a"),f.writeShort(u),f.writeShort(g),f.writeByte(128),f.writeByte(0),f.writeByte(0),f.writeByte(0),f.writeByte(0),f.writeByte(0),f.writeByte(255),f.writeByte(255),f.writeByte(255),f.writeString(","),f.writeShort(0),f.writeShort(0),f.writeShort(u),f.writeShort(g),f.writeByte(0);var l=2,T=t(l);f.writeByte(l);for(var B=0;T.length-B>255;)f.writeByte(255),f.writeBytes(T,B,255),B+=255;f.writeByte(T.length-B),f.writeBytes(T,B,T.length-B),f.writeByte(0),f.writeString(";")};var e=function(f){var l=f,T=0,B=0,E={};return E.write=function(R,P){if(R>>>P)throw"length over";for(;T+P>=8;)l.writeByte(255&(R<<T|B)),P-=8-T,R>>>=8-T,B=0,T=0;B=R<<T|B,T=T+P},E.flush=function(){T>0&&l.writeByte(B)},E},t=function(f){for(var l=1<<f,T=(1<<f)+1,B=f+1,E=v(),R=0;R<l;R+=1)E.add(String.fromCharCode(R));E.add(String.fromCharCode(l)),E.add(String.fromCharCode(T));var P=nt(),U=e(P);U.write(l,B);var q=0,$=String.fromCharCode(n[q]);for(q+=1;q<n.length;){var W=String.fromCharCode(n[q]);q+=1,E.contains($+W)?$=$+W:(U.write(E.indexOf($),B),E.size()<4095&&(E.size()==1<<B&&(B+=1),E.add($+W)),$=W)}return U.write(E.indexOf($),B),U.write(T,B),U.flush(),P.toByteArray()},v=function(){var f={},l=0,T={};return T.add=function(B){if(T.contains(B))throw"dup key:"+B;f[B]=l,l+=1},T.size=function(){return l},T.indexOf=function(B){return f[B]},T.contains=function(B){return typeof f[B]<"u"},T};return h},Bt=function(p,d,u){for(var g=Tt(p,d),n=0;n<d;n+=1)for(var h=0;h<p;h+=1)g.setPixel(h,n,u(h,n));var e=nt();g.write(e);for(var t=At(),v=e.toByteArray(),f=0;f<v.length;f+=1)t.writeByte(v[f]);return t.flush(),"data:image/gif;base64,"+t};return m}();(function(){b.stringToBytesFuncs["UTF-8"]=function(m){function A(k){for(var C=[],I=0;I<k.length;I++){var M=k.charCodeAt(I);M<128?C.push(M):M<2048?C.push(192|M>>6,128|M&63):M<55296||M>=57344?C.push(224|M>>12,128|M>>6&63,128|M&63):(I++,M=65536+((M&1023)<<10|k.charCodeAt(I)&1023),C.push(240|M>>18,128|M>>12&63,128|M>>6&63,128|M&63))}return C}return A(m)}})(),function(m){L.exports=m()}(function(){return b})})(H);var Q=H.exports;const st=J(Q);function ft(L,_){const b=st(0,"Q");b.addData(L),b.make();const m=b.getModuleCount(),A=_/(m+8),k=A*4;let C="";for(let F=0;F<m;F++)for(let G=0;G<m;G++)if(b.isDark(F,G)){const Z=G*A+k,z=F*A+k;C+=`M${Z},${z}h${A}v${A}h-${A}z`}const I=m*A+k*2,M=document.createElementNS("http://www.w3.org/2000/svg","svg");return M.setAttribute("viewBox",`0 0 ${I} ${I}`),M.setAttribute("width",String(_)),M.setAttribute("height",String(_)),M.innerHTML=`<path d="${C}" fill="#FFFFFF"/>`,M}const ut=`
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="preconnect" href="https://rsms.me/" />
    <link rel="preconnect" href="https://fonts.cdnfonts.com/" />
    <link rel="stylesheet" href="https://rsms.me/inter/inter.css" />
    <link
      rel="stylesheet"
      href="https://fonts.cdnfonts.com/css/cabinet-grotesk"
    />
    <style>
body,
html {
  margin: 0;
  padding: 0;
  background: transparent;
  background: #1d1f20;
  width: 100%;
  height: 100%;
}

a {
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  line-height: 22px;
  text-decoration-line: underline;
  color: #fd84e3;
}

@supports (font-variation-settings: normal) {
  :root {
    font-family: InterVariable, sans-serif;
  }
}

*::-webkit-scrollbar {
  display: none;
}

* {
  box-sizing: border-box;
  --Stroke: #c7bab8;
  --Elevation-0: #f3ebea;
  --Elevation-1: #ebdedc;
  --Elevation-2: #d9cdcb;
  --Black-Primary: #2c3034;
  --Black-Secondary: #6b6661;
  font-family: "Inter" -apple-system BlinkMacSystemFont "Segoe UI" "Roboto" "Oxygen" "Ubuntu" "Cantarell" "Fira Sans" "Droid Sans"
    "Helvetica Neue" sans-serif;
  -webkit-tap-highlight-color: transparent;
  -webkit-tap-highlight-color: transparent;
}

input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.popup {
  width: 100%;
  height: 100%;
  border-radius: 16px;
  background: var(--surface-common-default, #1d1f20);
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  padding: 24px;
}

.title {
  color: var(--text-primary, #ebdedc);
  font-feature-settings: "liga" off;
  font-family: "Cabinet Grotesk";
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
  margin: 0;
}
.title span {
  color: var(--text-orange, #e9c363);
  font-feature-settings: "liga" off;
  font-family: "Cabinet Grotesk";
  font-size: 24px;
  font-style: normal;
  font-weight: 800;
  line-height: normal;
}

.qr-code {
  background: url("https://hot-labs.org/hot-widget/qr.svg");
  background-size: cover;
  background-position: 0 -14px;
  width: 280px;
  height: 280px;
  display: flex;
  justify-content: center;
  align-items: center;
  position: relative;
}
.qr-code canvas {
  position: absolute;
  top: 70px;
  left: 70px;
}

.divider {
  color: var(--text-secondary, #ada5a4);
  font-family: Inter;
  font-size: 18px;
  font-style: normal;
  font-weight: 700;
  line-height: 22px;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  margin-bottom: 16px;
  margin-top: -8px;
}
.divider::before,
.divider::after {
  height: 1px;
  background: var(--border-lowest, rgba(255, 255, 255, 0.07));
  content: "";
  display: block;
  flex: 1;
}

.button {
  display: flex;
  padding: 12px 16px;
  justify-content: center;
  align-items: center;
  gap: 8px;
  align-self: stretch;
  border-radius: 16px;
  border: 1px solid var(--border-high, rgba(255, 255, 255, 0.25));
  background: var(--controls-teriary-3, #ffedb2);
  box-shadow: 4px 4px 0px 0px var(--controls-primary-dark-dark, #2c3034),
    5px 5px 0px 0px var(--controls-shadow-stroke, #3d3f46);
  color: var(--text-dark-dark, #2c3034);
  text-align: center;
  font-feature-settings: "liga" off, "calt" off;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: 20px;
  cursor: pointer;
  ouline: none;
}

.h4 {
  font-family: "Cabinet Grotesk";
  font-style: normal;
  font-weight: 800;
  font-size: 20px;
  line-height: 25px;
  color: #2c3034;
  margin: 0;
}

.close-button {
  position: absolute;
  top: 32px;
  right: 32px;
  height: 32px;
  width: 32px;
  padding: 0;
  font-family: "Inter";
  font-style: normal;
  font-weight: 600;
  font-size: 16px;
  color: #2c3034;
  border: none;
  margin: 0;
  outline: none;
  cursor: pointer;
  height: 32px;
  background: var(--surface-common-container--low, #262729);
  border-radius: 50px;
  justify-content: center;
  align-items: center;
  display: flex;
  cursor: pointer;
  transition: 0.2s opacity;
}
.close-button:hover {
  opacity: 0.7;
}
@media (max-width: 640px) {
  .close-button {
    right: 16px;
    top: 16px;
  }
}

.text {
  color: var(--text-secondary, #ada5a4);
  text-align: center;
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: 20px;
  margin: 0;
}

.text a {
  color: var(--text-blue, #6385ff);
  font-family: Inter;
  font-size: 16px;
  font-style: normal;
  font-weight: 600;
  line-height: 20px;
  text-decoration-line: underline;
  text-decoration-style: solid;
  text-decoration-skip-ink: auto;
  text-decoration-thickness: auto;
  text-underline-offset: auto;
  text-underline-position: from-font;
}
</style>
    <title>NEAR Connector</title>
`,lt=`
    <div class="popup">
      <h2 class="title">Approve in <span>App</span></h2>

      <div style="display: flex; gap: 12px;">
        <button class="button" style="white-space: nowrap; width: 140px; margin-top: 16px; margin-bottom: 32px" onclick="window.openMobile()">
           Open Mobile
        </button>

        <button class="button" style="white-space: nowrap; width: 140px; margin-top: 16px; margin-bottom: 32px" onclick="window.openTelegram()">
           Open Telegram
        </button>
      </div>

      <p class="text">
        Don’t have a wallet?<br />
        <a target="_blank" href="https://hot-labs.org/wallet/">Get extension • iOS • Android</a>
      </p>
    </div>
`,ht=`
    <div class="popup">
      <h1 class="title" style="margin-bottom: 14px">
        Scan in <span>HOT Wallet</span>
      </h1>
      
      <div class="qr-code"></div>

      <h2 class="divider">OR</h2>
      <h2 class="title">Approve in <span>App</span></h2>

      <div style="display: flex; gap: 12px;">
        <button class="button" style="width: 240px; margin-top: 16px; margin-bottom: 32px" onclick="window.openExtension()">
           Download Extension
        </button>
      </div>

      <p class="text">
        <a style="cursor: pointer" onclick="window.openTelegram()">Open via Telegram</a>
      </p>
    </div>
`,et="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";function vt(L){if(L.length===0)return"";let _=0,b=0;for(;b<L.length&&L[b]===0;)_++,b++;let m=[0];for(;b<L.length;b++){let k=L[b];for(let C=0;C<m.length;++C)k+=m[C]<<8,m[C]=k%58,k=k/58|0;for(;k>0;)m.push(k%58),k=k/58|0}for(;m.length>0&&m[m.length-1]===0;)m.pop();let A="";for(let k=0;k<_;k++)A+=et[0];for(let k=m.length-1;k>=0;--k)A+=et[m[k]];return A}const gt=()=>/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),ct=()=>{const L=document.createElement("div");L.style.height="100%",document.body.appendChild(L),document.head.innerHTML=ut,gt()?L.innerHTML=lt:L.innerHTML=ht},rt="https://h4n.app",pt=()=>window.crypto.randomUUID(),dt=L=>new Promise(_=>setTimeout(_,L));class wt extends Error{constructor(b){super();j(this,"name","RequestFailed");this.payload=b}}const X=class X{async getTimestamp(){const{ts:_}=await fetch("https://api0.herewallet.app/api/v1/web/time").then(m=>m.json()),b=BigInt(_)/10n**12n;return Number(b)*1e3}async getResponse(_){const b=await fetch(`${rt}/${_}/response`,{headers:{"content-type":"application/json"},method:"GET"});if(b.ok===!1)throw Error(await b.text());const{data:m}=await b.json();return JSON.parse(m)}async computeRequestId(_){const b=window.selector.location,m=await this.getTimestamp().catch(()=>Date.now()),A=vt(new TextEncoder().encode(JSON.stringify({..._,deadline:m+6e4,id:pt(),$hot:!0,origin:b}))),k=await crypto.subtle.digest("SHA-1",new TextEncoder().encode(A));return{requestId:[...new Uint8Array(k)].map(I=>I.toString(16).padStart(2,"0")).join(""),query:A}}async createRequest(_,b){const{query:m,requestId:A}=await this.computeRequestId(_),k=await fetch(`${rt}/${A}/request`,{body:JSON.stringify({data:m}),headers:{"content-type":"application/json"},method:"POST",signal:b});if(k.ok===!1)throw Error(await k.text());return A}async request(_,b){ct();const m=document.querySelector(".qr-code");m&&(m.innerHTML=""),window.selector.ui.showIframe();const A=await this.createRequest({method:_,request:b}),k=`hotcall-${A}`;m.appendChild(ft(`https://app.hot-labs.org/link?${k}`,140)),window.openTelegram=()=>window.selector.open(`https://t.me/hot_wallet/app?startapp=${k}`),window.openExtension=()=>window.selector.open("https://download.hot-labs.org?hotconnector"),window.openMobile=()=>window.selector.open(`hotwallet://${k}`);const C=async()=>{await dt(3e3);const M=await this.getResponse(A).catch(()=>null);if(M==null)return await C();if(M.success)return M.payload;throw new wt(M.payload)};return await C()}};j(X,"shared",new X);let K=X;class xt{constructor(){j(this,"getAccounts",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";const b=await window.selector.storage.get("hot-account");return b?[JSON.parse(b)]:[]});j(this,"signIn",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";const b=await K.shared.request("near:signIn",{});return window.selector.storage.set("hot-account",JSON.stringify(b)),[b]});j(this,"signOut",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";await window.selector.storage.remove("hot-account")});j(this,"signMessage",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";return await K.shared.request("near:signMessage",_)});j(this,"signAndSendTransaction",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";const{transactions:b}=await K.shared.request("near:signAndSendTransactions",{transactions:[_]});return b[0]});j(this,"signAndSendTransactions",async _=>{if(_.network==="testnet")throw"HOT Wallet not supported on testnet";const{transactions:b}=await K.shared.request("near:signAndSendTransactions",{transactions:_.transactions});return b})}}window.selector.ready(new xt)})();
