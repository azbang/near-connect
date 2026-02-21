"use strict";Object.defineProperty(exports,Symbol.toStringTag,{value:"Module"});class y{async get(e){return typeof window>"u"?null:localStorage.getItem(e)}async set(e,t){typeof window>"u"||localStorage.setItem(e,t)}async remove(e){typeof window>"u"||localStorage.removeItem(e)}}const p="123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";function A(r){if(r.length===0)return"";let e=0,t=0;for(;t<r.length&&r[t]===0;)e++,t++;let n=[0];for(;t<r.length;t++){let o=r[t];for(let a=0;a<n.length;++a)o+=n[a]<<8,n[a]=o%58,o=o/58|0;for(;o>0;)n.push(o%58),o=o/58|0}for(;n.length>0&&n[n.length-1]===0;)n.pop();let s="";for(let o=0;o<e;o++)s+=p[0];for(let o=n.length-1;o>=0;--o)s+=p[n[o]];return s}const C=r=>{try{return JSON.parse(new TextDecoder().decode(r))}catch{return r}},h=r=>r.map(e=>{if("type"in e)return e;if(e.functionCall)return{type:"FunctionCall",params:{methodName:e.functionCall.methodName,args:C(e.functionCall.args),gas:e.functionCall.gas.toString(),deposit:e.functionCall.deposit.toString()}};if(e.deployGlobalContract)return{type:"DeployGlobalContract",params:{code:e.deployGlobalContract.code,deployMode:e.deployGlobalContract.deployMode.AccountId?"AccountId":"CodeHash"}};if(e.createAccount)return{type:"CreateAccount"};if(e.useGlobalContract)return{type:"UseGlobalContract",params:{contractIdentifier:e.useGlobalContract.contractIdentifier.AccountId?{accountId:e.useGlobalContract.contractIdentifier.AccountId}:{codeHash:A(e.useGlobalContract.contractIdentifier.CodeHash)}}};if(e.deployContract)return{type:"DeployContract",params:{code:e.deployContract.code}};if(e.deleteAccount)return{type:"DeleteAccount",params:{beneficiaryId:e.deleteAccount.beneficiaryId}};if(e.deleteKey)return{type:"DeleteKey",params:{publicKey:e.deleteKey.publicKey.toString()}};if(e.transfer)return{type:"Transfer",params:{deposit:e.transfer.deposit.toString()}};if(e.stake)return{type:"Stake",params:{stake:e.stake.stake.toString(),publicKey:e.stake.publicKey.toString()}};if(e.addKey)return{type:"AddKey",params:{publicKey:e.addKey.publicKey.toString(),accessKey:{nonce:Number(e.addKey.accessKey.nonce),permission:e.addKey.accessKey.permission.functionCall?{receiverId:e.addKey.accessKey.permission.functionCall.receiverId,allowance:e.addKey.accessKey.permission.functionCall.allowance?.toString(),methodNames:e.addKey.accessKey.permission.functionCall.methodNames}:"FullAccess"}}};throw new Error("Unsupported action type")}),g=()=>typeof window<"u"&&typeof window.crypto<"u"&&typeof window.crypto.randomUUID=="function"?window.crypto.randomUUID():"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g,function(r){const e=Math.random()*16|0;return(r==="x"?e:e&3|8).toString(16)});class x{constructor(e,t){this.connector=e,this.manifest=t}callParentFrame(e,t){const n=g();return window.parent.postMessage({type:"near-wallet-injected-request",id:n,method:e,params:t},"*"),new Promise((s,o)=>{const a=i=>{i.data.type==="near-wallet-injected-response"&&i.data.id===n&&(window.removeEventListener("message",a),i.data.success?s(i.data.result):o(i.data.error))};window.addEventListener("message",a)})}async signIn(e){const t=await this.callParentFrame("near:signIn",{network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames});return Array.isArray(t)?t:[t]}async signInAndSignMessage(e){const t=await this.callParentFrame("near:signInAndSignMessage",{network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames,messageParams:e.messageParams});return Array.isArray(t)?t:[t]}async signOut(e){const t={...e,network:e?.network||this.connector.network};await this.callParentFrame("near:signOut",t)}async getAccounts(e){const t={...e,network:e?.network||this.connector.network};return this.callParentFrame("near:getAccounts",t)}async signAndSendTransaction(e){const t=h(e.actions),n={...e,actions:t,network:e.network||this.connector.network};return this.callParentFrame("near:signAndSendTransaction",n)}async signAndSendTransactions(e){const t={...e,network:e.network||this.connector.network};return t.transactions=t.transactions.map(n=>({actions:h(n.actions),receiverId:n.receiverId})),this.callParentFrame("near:signAndSendTransactions",t)}async signMessage(e){const t={...e,network:e.network||this.connector.network};return this.callParentFrame("near:signMessage",t)}async signDelegateActions(e){const t={...e,delegateActions:e.delegateActions.map(n=>({...n,actions:h(n.actions)})),network:e.network||this.connector.network};return this.callParentFrame("near:signDelegateActions",t)}}const u=r=>{try{return new URL(r)}catch{return null}};class b{events={};on(e,t){this.events[e]||(this.events[e]=[]),this.events[e].push(t)}emit(e,t){this.events[e]?.forEach(n=>n(t))}off(e,t){this.events[e]=this.events[e]?.filter(n=>n!==t)}once(e,t){const n=s=>{t(s),this.off(e,n)};this.on(e,n)}removeAllListeners(e){e?delete this.events[e]:this.events={}}}function $(r){return r.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#039;")}const m=Symbol("htmlTag");function d(r,...e){let t=r[0];for(let n=0;n<e.length;n++){for(const s of Array.isArray(e[n])?e[n]:[e[n]]){const o=s?.[m]?s[m]:$(String(s??""));t+=o}t+=r[n+1]}return Object.freeze({[m]:t,get html(){return t}})}const E=r=>`
${r} * {
  box-sizing: border-box;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol";
  -ms-overflow-style: none; 
  scrollbar-width: none; 
  color: #fff;
}

${r} *::-webkit-scrollbar { 
  display: none;
}

${r} p,
${r} h1,
${r} h2,
${r} h3,
${r} h4,
${r} h5,
${r} h6 {
  margin: 0;
}

${r} .modal-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 100000000;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    transition: opacity 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${r} .modal-container {
    justify-content: flex-end;
  }
}

${r} .modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;

  max-width: 420px;
  max-height: 615px;
  width: 100%;
  border-radius: 24px;
  background: #0d0d0d;
  border: 1.5px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.2s ease-in-out;
}

@media (max-width: 600px) {
  ${r} .modal-content {
    max-width: 100%;
    width: 100%;
    max-height: 80%;
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
    border: none;
    border-top: 1.5px solid rgba(255, 255, 255, 0.1);
  }
}


${r} .modal-header {
  display: flex;
  padding: 16px;
  gap: 16px;
  align-self: stretch;
  align-items: center;
  justify-content: center;
  position: relative;
}

${r} .modal-header button {
  position: absolute;
  right: 16px;
  top: 16px;
  width: 32px;
  height: 32px;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s ease-in-out;
  border: none;
  background: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

${r} .modal-header button:hover {
  background: rgba(255, 255, 255, 0.04);
}
  
${r} .modal-header p {
  color: #fff;
  text-align: center;
  font-size: 24px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  margin: 0;
}


${r} .modal-body {
  display: flex;
  padding: 16px;
  flex-direction: column;
  align-items: flex-start;
  text-align: center;
  gap: 8px;
  overflow: auto;

  border-radius: 24px;
  background: rgba(255, 255, 255, 0.08);
  width: 100%;
  flex: 1;
}

${r} .modal-body textarea {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #0d0d0d;
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.1);
  outline: none;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  font-family: monospace;
  font-size: 12px;
}

${r} .modal-body button {
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  color: #000;
  border: none;
  cursor: pointer;
  font-size: 16px;
  transition: background 0.2s ease-in-out;
  margin-top: 16px;
}

${r} .footer {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding: 16px 24px;
  color: #fff;
  gap: 12px;
}

${r} .modal-body p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  line-height: normal;
  letter-spacing: -0.8px;
}

${r} .footer img {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
}

${r} .get-wallet-link {
  color: rgba(255, 255, 255, 0.5);
  text-align: center;
  font-size: 16px;
  font-style: normal;
  font-weight: 500;
  margin-left: auto;
  text-decoration: none;
  transition: color 0.2s ease-in-out;
  cursor: pointer;
}
  
${r} .get-wallet-link:hover {
  color: rgba(255, 255, 255, 1);
}


${r} .connect-item {
  display: flex;
  padding: 8px;
  align-items: center;
  gap: 12px;
  align-self: stretch;
  cursor: pointer;

  transition: background 0.2s ease-in-out;
  border-radius: 24px;
}

${r} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
  flex-shrink: 0;
}

${r} .connect-item-info {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  text-align: left;
  flex: 1;
  margin-top: -2px;
}

${r} .connect-item-info .wallet-address {
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  font-style: normal;
  font-weight: 400;
  line-height: normal;
}

${r} .connect-item:hover {
  background: rgba(255, 255, 255, 0.04);
}

${r} .connect-item img {
  width: 48px;
  height: 48px;
  border-radius: 16px;
  object-fit: cover;
}

${r} .connect-item p {
  color: rgba(255, 255, 255, 0.9);
  text-align: center;
  font-size: 18px;
  font-style: normal;
  font-weight: 600;
  line-height: normal;
  letter-spacing: -0.36px;
  margin: 0;
}
`,v=`n${Math.random().toString(36).substring(2,15)}`;if(typeof document<"u"){const r=document.createElement("style");r.textContent=E(`.${v}`),document.head.append(r)}class k{constructor(e){this.delegate=e}isClosed=!1;root=document.createElement("div");state={};get dom(){return d``}disposables=[];addListener(e,t,n){const s=typeof e=="string"?this.root.querySelector(e):e;s&&(s.addEventListener(t,n),this.disposables.push(()=>s.removeEventListener(t,n)))}handlers(){this.disposables.forEach(n=>n()),this.disposables=[];const e=this.root.querySelector(".modal-container"),t=this.root.querySelector(".modal-content");t.onclick=n=>n.stopPropagation(),e.onclick=()=>{this.delegate.onReject(),this.destroy()}}update(e){this.state={...this.state,...e},this.root.innerHTML=this.dom.html,this.handlers()}create({show:e=!0}){this.root.className=`${v} hot-connector-popup`,this.root.innerHTML=this.dom.html,document.body.append(this.root),this.handlers();const t=this.root.querySelector(".modal-container"),n=this.root.querySelector(".modal-content");n.style.transform="translateY(50px)",t.style.opacity="0",this.root.style.display="none",e&&setTimeout(()=>this.show(),10)}show(){const e=this.root.querySelector(".modal-container"),t=this.root.querySelector(".modal-content");t.style.transform="translateY(50px)",e.style.opacity="0",this.root.style.display="block",setTimeout(()=>{t.style.transform="translateY(0)",e.style.opacity="1"},100)}hide(){const e=this.root.querySelector(".modal-container"),t=this.root.querySelector(".modal-content");t.style.transform="translateY(50px)",e.style.opacity="0",setTimeout(()=>{this.root.style.display="none"},200)}destroy(){this.isClosed||(this.isClosed=!0,this.hide(),setTimeout(()=>{this.root.remove()},200))}}class P extends k{constructor(e){super(e),this.delegate=e}handlers(){super.handlers(),this.addListener("button","click",()=>this.delegate.onApprove())}create(){super.create({show:!1}),this.root.querySelector(".modal-body").appendChild(this.delegate.iframe),this.delegate.iframe.style.width="100%",this.delegate.iframe.style.height="720px",this.delegate.iframe.style.border="none"}get footer(){if(!this.delegate.footer)return"";const{icon:e,heading:t}=this.delegate.footer;return d`
      <div class="footer">
        ${e?d`<img src="${e}" alt="${t}" />`:""}
        <p>${t}</p>
      </div>
    `}get dom(){return d`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-body" style="padding: 0; overflow: auto;"></div>
        ${this.footer}
      </div>
    </div>`}}async function M(r){const e=await r.executor.getAllStorage(),t=r.executor.connector.providers,n=r.executor.manifest,s=r.id,o=r.code.replaceAll(".localStorage",".sandboxedLocalStorage").replaceAll("window.top","window.selector").replaceAll("window.open","window.selector.open");return`
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body>
      <div id="root"></div>

      <style>
        :root {
          --background-color: rgb(40, 40, 40);
          --text-color: rgb(255, 255, 255);
          --border-color: rgb(209, 209, 209);
        }

        * {
          font-family: system-ui, Avenir, Helvetica, Arial, sans-serif
        }

        body, html {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
          background-color: var(--background-color);
          color: var(--text-color);
        }

        #root {
          display: none;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100vh;
          width: 100vw;
          background: radial-gradient(circle at center, #2c2c2c 0%, #1a1a1a 100%);
          text-align: center;
        }

        #root * {
          box-sizing: border-box;
          font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
          line-height: 1.5;
          color-scheme: light dark;
          color: rgb(255, 255, 255);
          font-synthesis: none;
          text-rendering: optimizeLegibility;
          -webkit-font-smoothing: antialiased;
        }

        .prompt-container img {
          width: 100px;
          height: 100px;
          object-fit: cover;
          border-radius: 12px;
        }

        .prompt-container h1 {
          margin: 0;
          font-size: 24px;
          font-weight: 600;
          margin-top: 16px;
        }

        .prompt-container p {
          margin: 0;
          font-size: 16px;
          font-weight: 500;
          color: rgb(209, 209, 209);
        }

        .prompt-container button {
          background-color: #131313;
          border: none;
          border-radius: 12px;
          padding: 12px 24px;
          cursor: pointer;
          transition: border-color 0.25s;
          color: #fff;
          outline: none;
          font-size: 14px;
          font-weight: 500;
          font-family: inherit;
          margin-top: 16px;
        }
      </style>


      <script>
      window.sandboxedLocalStorage = (() => {
        let storage = ${JSON.stringify(e)}

        return {
          setItem: function(key, value) {
            window.selector.storage.set(key, value)
            storage[key] = value || '';
          },
          getItem: function(key) {
            return key in storage ? storage[key] : null;
          },
          removeItem: function(key) {
            window.selector.storage.remove(key)
            delete storage[key];
          },
          get length() {
            return Object.keys(storage).length;
          },
          key: function(i) {
            const keys = Object.keys(storage);
            return keys[i] || null;
          },
        };
      })();

      const showPrompt = async (args) => {
        const root = document.getElementById("root");   
        root.style.display = "flex";
        root.innerHTML = \`
          <div class="prompt-container">
            <img src="${n.icon}" />
            <h1>${n.name}</h1>
            <p>\${args.title}</p>
            <button>\${args.button}</button>
          </div>
        \`;

        return new Promise((resolve) => {
          root.querySelector("button")?.addEventListener("click", () => {
            root.innerHTML = "";
            resolve(true);
          });
        });
      }

      class ProxyWindow {
        constructor(url, features) {
          this.closed = false;
          this.windowIdPromise = window.selector.call("open", { url, features });

          window.addEventListener("message", async (event) => {            
            if (event.data.origin !== "${s}") return;
            if (!event.data.method?.startsWith("proxy-window:")) return;
            const method = event.data.method.replace("proxy-window:", "");
            if (method === "closed" && event.data.windowId === await this.id()) this.closed = true;
          });
        } 

        async id() {
          return await this.windowIdPromise;
        }

        async focus() {
          await window.selector.call("panel.focus", { windowId: await this.id() });
        }

        async postMessage(data) {
          window.selector.call("panel.postMessage", { windowId: await this.id(), data });
        }

        async close() {
          await window.selector.call("panel.close", { windowId: await this.id() });
        }
      }

      window.selector = {
        wallet: null,
        location: "${window.location.href}",
        
        outerHeight: ${window.outerHeight},
        screenY: ${window.screenY},
        outerWidth: ${window.outerWidth},
        screenX: ${window.screenX},

        providers: {
          mainnet: ${JSON.stringify(t.mainnet)},
          testnet: ${JSON.stringify(t.testnet)},
        },

        uuid() {
          return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c === "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
        },

        walletConnect: {
          connect(params) {
            return window.selector.call("walletConnect.connect", params);
          },
          disconnect(params) {
            return window.selector.call("walletConnect.disconnect", params);
          },
          request(params) {
            return window.selector.call("walletConnect.request", params);
          },
          getProjectId() {
            return window.selector.call("walletConnect.getProjectId", {});
          },
          getSession() {
            return window.selector.call("walletConnect.getSession", {});
          },
        },
      
        async ready(wallet) {
          window.parent.postMessage({ method: "wallet-ready", origin: "${s}" }, "*");
          window.selector.wallet = wallet;
        },

        async call(method, params) {
          const id = window.selector.uuid();
          window.parent.postMessage({ method, params, id, origin: "${s}" }, "*");

          return new Promise((resolve, reject) => {
            const handler = (event) => {
              if (event.data.id !== id || event.data.origin !== "${s}") return;
              window.removeEventListener("message", handler);

              if (event.data.status === "failed") reject(event.data.result);
              else resolve(event.data.result);
            };

            window.addEventListener("message", handler);
          });
        },

        panelClosed(windowId) {
          window.parent.postMessage({ 
            method: "panel.closed", 
            origin: "${s}", 
            result: { windowId } 
          }, "*");
        },

        open(url, _, params) {
          return new ProxyWindow(url, params)
        },

        external(entity, key, ...args) {
          return window.selector.call("external", { entity, key, args: args || [] });
        },

        openNativeApp(url) {
          return window.selector.call("open.nativeApp", { url });
        },

        ui: {
          async whenApprove(options) {
            window.selector.ui.showIframe();
            await showPrompt(options);
            window.selector.ui.hideIframe();
          },

          async showIframe() {
            return await window.selector.call("ui.showIframe");
          },

          async hideIframe() {
            return await window.selector.call("ui.hideIframe");
          },
        },

        storage: {
          async set(key, value) {
            await window.selector.call("storage.set", { key, value });
          },
      
          async get(key) {
            return await window.selector.call("storage.get", { key });
          },
      
          async remove(key) {
            await window.selector.call("storage.remove", { key });
          },

          async keys() {
            return await window.selector.call("storage.keys", {});
          },
        },
      };

      window.addEventListener("message", async (event) => {
        if (event.data.origin !== "${s}") return;
        if (!event.data.method?.startsWith("wallet:")) return;
      
        const wallet = window.selector.wallet;
        const method = event.data.method.replace("wallet:", "");
        const payload = { id: event.data.id, origin: "${s}", method };
      
        if (wallet == null || typeof wallet[method] !== "function") {
          const data = { ...payload, status: "failed", result: "Method not found" };
          window.parent.postMessage(data, "*");
          return;
        }
        
        try {
          const result = await wallet[method](event.data.params);
          window.parent.postMessage({ ...payload, status: "success", result }, "*");
        } catch (error) {
          const data = { ...payload, status: "failed", result: error };
          window.parent.postMessage(data, "*");
        }
      });
      <\/script>

      <script type="module">${o}<\/script>
    </body>
  </html>
    `}class N{constructor(e,t,n){this.executor=e,this.origin=g(),this.handler=o=>{o.data.origin===this.origin&&(o.data.method==="wallet-ready"&&this.readyPromiseResolve(),n(this,o))},window.addEventListener("message",this.handler);const s=[];this.executor.checkPermissions("usb")&&s.push("usb *;"),this.executor.checkPermissions("hid")&&s.push("hid *;"),this.executor.checkPermissions("clipboardRead")&&s.push("clipboard-read;"),this.executor.checkPermissions("clipboardWrite")&&s.push("clipboard-write;"),this.iframe.allow=s.join(" "),this.iframe.setAttribute("sandbox","allow-scripts"),M({id:this.origin,executor:this.executor,code:t}).then(o=>{this.executor.connector.logger?.log("Iframe code injected"),this.iframe.srcdoc=o}),this.popup=new P({footer:this.executor.connector.footerBranding,iframe:this.iframe,onApprove:()=>{},onReject:()=>{window.removeEventListener("message",this.handler),this.events.emit("close",{}),this.popup.destroy()}}),this.popup.create()}origin;iframe=document.createElement("iframe");events=new b;popup;handler;readyPromiseResolve;readyPromise=new Promise(e=>{this.readyPromiseResolve=e});on(e,t){this.events.on(e,t)}show(){this.popup.show()}hide(){this.popup.hide()}postMessage(e){if(!this.iframe.contentWindow)throw new Error("Iframe not loaded");this.iframe.contentWindow.postMessage({...e,origin:this.origin},"*")}dispose(){window.removeEventListener("message",this.handler),this.popup.destroy()}}const W=g();class L{constructor(e,t){this.connector=e,this.manifest=t,this.storageSpace=t.id}activePanels={};storageSpace;checkPermissions(e,t){if(e==="walletConnect")return!!this.manifest.permissions.walletConnect;if(e==="external"){const n=this.manifest.permissions.external;return!n||!t?.entity?!1:n.includes(t.entity)}if(e==="allowsOpen"){const n=u(t?.url||""),s=this.manifest.permissions.allowsOpen;return!n||!s||!Array.isArray(s)||s.length===0?!1:s.some(a=>{const i=u(a);return!(!i||n.protocol!==i.protocol||i.hostname&&n.hostname!==i.hostname||i.pathname&&i.pathname!=="/"&&n.pathname!==i.pathname)})}return this.manifest.permissions[e]}assertPermissions(e,t,n){if(!this.checkPermissions(t,n.data.params))throw e.postMessage({...n.data,status:"failed",result:"Permission denied"}),new Error("Permission denied")}_onMessage=async(e,t)=>{const n=o=>{e.postMessage({...t.data,status:"success",result:o})},s=o=>{e.postMessage({...t.data,status:"failed",result:o})};if(t.data.method==="ui.showIframe"){e.show(),n(null);return}if(t.data.method==="ui.hideIframe"){e.hide(),n(null);return}if(t.data.method==="storage.set"){this.assertPermissions(e,"storage",t),localStorage.setItem(`${this.storageSpace}:${t.data.params.key}`,t.data.params.value),n(null);return}if(t.data.method==="storage.get"){this.assertPermissions(e,"storage",t);const o=localStorage.getItem(`${this.storageSpace}:${t.data.params.key}`);n(o);return}if(t.data.method==="storage.keys"){this.assertPermissions(e,"storage",t);const o=Object.keys(localStorage).filter(a=>a.startsWith(`${this.storageSpace}:`));n(o);return}if(t.data.method==="storage.remove"){this.assertPermissions(e,"storage",t),localStorage.removeItem(`${this.storageSpace}:${t.data.params.key}`),n(null);return}if(t.data.method==="panel.focus"){const o=this.activePanels[t.data.params.windowId];o&&o.focus(),n(null);return}if(t.data.method==="panel.postMessage"){const o=this.activePanels[t.data.params.windowId];o&&o.postMessage(t.data.params.data,"*"),n(null);return}if(t.data.method==="panel.close"){const o=this.activePanels[t.data.params.windowId];o&&o.close(),delete this.activePanels[t.data.params.windowId],n(null);return}if(t.data.method==="walletConnect.connect"){this.assertPermissions(e,"walletConnect",t);try{if(!this.connector.walletConnect)throw new Error("WalletConnect is not configured");const a=await(await this.connector.walletConnect).connect(t.data.params);a.approval(),n({uri:a.uri})}catch(o){s(o)}return}if(t.data.method==="walletConnect.getProjectId"){if(!this.connector.walletConnect)throw new Error("WalletConnect is not configured");this.assertPermissions(e,"walletConnect",t);const o=await this.connector.walletConnect;n(o.core.projectId);return}if(t.data.method==="walletConnect.disconnect"){this.assertPermissions(e,"walletConnect",t);try{if(!this.connector.walletConnect)throw new Error("WalletConnect is not configured");const a=await(await this.connector.walletConnect).disconnect(t.data.params);n(a)}catch(o){s(o)}return}if(t.data.method==="walletConnect.getSession"){this.assertPermissions(e,"walletConnect",t);try{if(!this.connector.walletConnect)throw new Error("WalletConnect is not configured");const o=await this.connector.walletConnect,a=o.session.keys[o.session.keys.length-1],i=a?o.session.get(a):null;n(i?{topic:i.topic,namespaces:i.namespaces}:null)}catch(o){s(o)}return}if(t.data.method==="walletConnect.request"){this.assertPermissions(e,"walletConnect",t);try{if(!this.connector.walletConnect)throw new Error("WalletConnect is not configured");const a=await(await this.connector.walletConnect).request(t.data.params);n(a)}catch(o){s(o)}return}if(t.data.method==="external"){this.assertPermissions(e,"external",t);try{const{entity:o,key:a,args:i}=t.data.params,l=o.split(".").reduce((w,I)=>w[I],window);o==="nightly.near"&&a==="signTransaction"&&(i[0].encode=()=>i[0]);const c=typeof l[a]=="function"?await l[a](...i||[]):l[a];n(c)}catch(o){s(o)}return}if(t.data.method==="open"){this.assertPermissions(e,"allowsOpen",t);const o=typeof window<"u"?window?.Telegram?.WebApp:null;if(o&&t.data.params.url.startsWith("https://t.me")){o.openTelegramLink(t.data.params.url);return}const a=window.open(t.data.params.url,"_blank",t.data.params.features),i=a?g():null,l=c=>{const w=u(t.data.params.url);w&&w.origin===c.origin&&e.postMessage(c.data)};if(n(i),window.addEventListener("message",l),a&&i){this.activePanels[i]=a;const c=setInterval(()=>{if(!a?.closed)return;window.removeEventListener("message",l);const w={method:"proxy-window:closed",windowId:i};delete this.activePanels[i],clearInterval(c);try{e.postMessage(w)}catch{}},500)}return}if(t.data.method==="open.nativeApp"){this.assertPermissions(e,"allowsOpen",t);const o=u(t.data.params.url);if(!o||["https","http","javascript:","file:","data:","blob:","about:"].includes(o.protocol))throw s("Invalid URL"),new Error("[open.nativeApp] Invalid URL");const i=document.createElement("iframe");i.src=t.data.params.url,i.style.display="none",document.body.appendChild(i),e.postMessage({...t.data,status:"success",result:null});return}};actualCode=null;async checkNewVersion(e,t){if(this.actualCode)return this.connector.logger?.log("New version of code already checked"),this.actualCode;let n=u(e.manifest.executor);if(n||(n=u(location.origin+e.manifest.executor)),!n)throw new Error("Invalid executor URL");n.searchParams.set("nonce",W);const s=await fetch(n.toString()).then(o=>o.text());return this.connector.logger?.log("New version of code fetched"),this.actualCode=s,s===t?(this.connector.logger?.log("New version of code is the same as the current version"),this.actualCode):(await this.connector.db.setItem(`${this.manifest.id}:${this.manifest.version}`,s),this.connector.logger?.log("New version of code saved to cache"),s)}async loadCode(){const e=await this.connector.db.getItem(`${this.manifest.id}:${this.manifest.version}`).catch(()=>null);this.connector.logger?.log("Code loaded from cache",e!==null);const t=this.checkNewVersion(this,e);return e||await t}async call(e,t){this.connector.logger?.log("Add to queue",e,t),this.connector.logger?.log("Calling method",e,t);const n=await this.loadCode();this.connector.logger?.log("Code loaded, preparing");const s=new N(this,n,this._onMessage);this.connector.logger?.log("Code loaded, iframe initialized"),await s.readyPromise,this.connector.logger?.log("Iframe ready");const o=g();return new Promise((a,i)=>{try{const l=c=>{c.data.id!==o||c.data.origin!==s.origin||(s.dispose(),window.removeEventListener("message",l),this.connector.logger?.log("postMessage",{result:c.data,request:{method:e,params:t}}),c.data.status==="failed"?i(c.data.result):a(c.data.result))};window.addEventListener("message",l),s.postMessage({method:e,params:t,id:o}),s.on("close",()=>i(new Error("Wallet closed")))}catch(l){this.connector.logger?.log("Iframe error",l),i(l)}})}async getAllStorage(){const e=Object.keys(localStorage).filter(n=>n.startsWith(`${this.storageSpace}:`)),t={};for(const n of e)t[n.replace(`${this.storageSpace}:`,"")]=localStorage.getItem(n);return t}async clearStorage(){const e=Object.keys(localStorage).filter(t=>t.startsWith(`${this.storageSpace}:`));for(const t of e)localStorage.removeItem(t)}}class f{constructor(e,t){this.connector=e,this.manifest=t,this.executor=new L(e,t)}executor;async signIn(e){return this.executor.call("wallet:signIn",{network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames})}async signInAndSignMessage(e){return this.executor.call("wallet:signInAndSignMessage",{network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames,messageParams:e.messageParams})}async signOut(e){const t={...e,network:e?.network||this.connector.network};await this.executor.call("wallet:signOut",t),await this.executor.clearStorage()}async getAccounts(e){const t={...e,network:e?.network||this.connector.network};return this.executor.call("wallet:getAccounts",t)}async signAndSendTransaction(e){const t=h(e.actions),n={...e,actions:t,network:e.network||this.connector.network};return this.executor.call("wallet:signAndSendTransaction",n)}async signAndSendTransactions(e){const t=e.transactions.map(s=>({actions:h(s.actions),receiverId:s.receiverId})),n={...e,transactions:t,network:e.network||this.connector.network};return this.executor.call("wallet:signAndSendTransactions",n)}async signMessage(e){const t={...e,network:e.network||this.connector.network};return this.executor.call("wallet:signMessage",t)}async signDelegateActions(e){const t={...e,delegateActions:e.delegateActions.map(n=>({...n,actions:h(n.actions)})),network:e.network||this.connector.network};return this.executor.call("wallet:signDelegateActions",t)}}class S{constructor(e,t){this.connector=e,this.wallet=t}get manifest(){return this.wallet.manifest}async signIn(e){return this.wallet.signIn({network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames})}async signInAndSignMessage(e){return this.wallet.signInAndSignMessage({network:e?.network||this.connector.network,contractId:e?.contractId,methodNames:e?.methodNames,messageParams:e.messageParams})}async signOut(e){await this.wallet.signOut({network:e?.network||this.connector.network})}async getAccounts(e){return this.wallet.getAccounts({network:e?.network||this.connector.network})}async signAndSendTransaction(e){const t=h(e.actions),n=e.network||this.connector.network,s=await this.wallet.signAndSendTransaction({...e,actions:t,network:n});if(!s)throw new Error("No result from wallet");return Array.isArray(s.transactions)?s.transactions[0]:s}async signAndSendTransactions(e){const t=e.network||this.connector.network,n=e.transactions.map(o=>({actions:h(o.actions),receiverId:o.receiverId})),s=await this.wallet.signAndSendTransactions({...e,transactions:n,network:t});if(!s)throw new Error("No result from wallet");return Array.isArray(s.transactions)?s.transactions:s}async signMessage(e){return this.wallet.signMessage({...e,network:e.network||this.connector.network})}async signDelegateActions(e){return this.wallet.signDelegateActions({...e,delegateActions:e.delegateActions.map(t=>({...t,actions:h(t.actions)})),network:e.network||this.connector.network})}}const D={id:"custom-wallet",name:"Custom Wallet",icon:"https://www.mynearwallet.com/images/webclip.png",description:"Custom wallet for NEAR.",website:"",version:"1.0.0",executor:"your-executor-url.js",type:"sandbox",platform:{},features:{signMessage:!0,signInWithoutAddKey:!0,signInAndSignMessage:!0,signAndSendTransaction:!0,signAndSendTransactions:!0,signDelegateActions:!0},permissions:{storage:!0,allowsOpen:[]}};class j extends k{constructor(e){super(e),this.delegate=e,this.update({wallets:e.wallets,showSettings:!1})}handlers(){super.handlers(),this.addListener(".settings-button","click",()=>this.update({showSettings:!0})),this.addListener(".back-button","click",()=>this.update({showSettings:!1})),this.root.querySelectorAll(".connect-item").forEach(e=>{e instanceof HTMLDivElement&&this.addListener(e,"click",()=>this.delegate.onSelect(e.dataset.type))}),this.root.querySelectorAll(".remove-wallet-button").forEach(e=>{e instanceof SVGSVGElement&&this.addListener(e,"click",async t=>{t.stopPropagation(),await this.delegate.onRemoveDebugManifest(e.dataset.type);const n=this.state.wallets.filter(s=>s.id!==e.dataset.type);this.update({wallets:n})})}),this.addListener(".add-debug-manifest-button","click",async()=>{try{const e=this.root.querySelector("#debug-manifest-input")?.value??"",t=await this.delegate.onAddDebugManifest(e);this.update({showSettings:!1,wallets:[t,...this.state.wallets]})}catch(e){alert(`Something went wrong: ${e}`)}})}create(){super.create({show:!0})}walletDom(e){const t=d`
      <svg
        class="remove-wallet-button"
        data-type="${e.id}"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style="margin-right: 4px;"
      >
        <path d="M18 6L6 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <path d="M6 6L18 18" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    `;return d`
      <div class="connect-item" data-type="${e.id}">
        <img style="background: #333" src="${e.icon}" alt="${e.name}" />
        <div class="connect-item-info">
          <span>${e.name}</span>
          <span class="wallet-address">${u(e.website)?.hostname}</span>
        </div>
        ${e.debug?t:""}
      </div>
    `}get footer(){if(!this.delegate.footer)return"";const{icon:e,heading:t,link:n,linkText:s}=this.delegate.footer;return d`
      <div class="footer">
        ${e?d`<img src="${e}" alt="${t}" />`:""}
        <p>${t}</p>
        <a class="get-wallet-link" href="${n}" target="_blank">${s}</a>
      </div>
    `}get dom(){return this.state.showSettings?d`
        <div class="modal-container">
          <div class="modal-content">
            <div class="modal-header">
              <button class="back-button" style="left: 16px; right: unset;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M15 18L9 12L15 6" stroke="rgba(255,255,255,0.5)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <p>Settings</p>
            </div>

            <div class="modal-body">
              <p style="text-align: left;">
                You can add your wallet to dapp for debug,
                <a href="https://github.com/azbang/hot-connector" target="_blank">read the documentation.</a> Paste your manifest and click "Add".
              </p>

              <textarea style="width: 100%;" id="debug-manifest-input" rows="10">${JSON.stringify(D,null,2)}</textarea>
              <button class="add-debug-manifest-button">Add</button>
            </div>

            ${this.footer}
          </div>
        </div>
      `:d`<div class="modal-container">
      <div class="modal-content">
        <div class="modal-header">
          <p>Select wallet</p>
          <button class="settings-button">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="19" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
              <circle cx="5" cy="12" r="2" fill="rgba(255,255,255,0.5)" />
            </svg>
          </button>
        </div>

        <div class="modal-body">${this.state.wallets.map(e=>this.walletDom(e))}</div>

        ${this.footer}
      </div>
    </div>`}}class T{dbName;storeName;version;constructor(e,t){this.dbName=e,this.storeName=t,this.version=1}getDb(){return new Promise((e,t)=>{if(typeof window>"u"||typeof indexedDB>"u"){t(new Error("IndexedDB is not available (SSR environment)"));return}const n=indexedDB.open(this.dbName,this.version);n.onerror=s=>{console.error("Error opening database:",s.target.error),t(new Error("Error opening database"))},n.onsuccess=s=>{e(n.result)},n.onupgradeneeded=s=>{const o=n.result;o.objectStoreNames.contains(this.storeName)||o.createObjectStore(this.storeName)}})}async getItem(e){const t=await this.getDb();if(typeof e=="number"&&(e=e.toString()),typeof e!="string")throw new Error("Key must be a string");return new Promise((n,s)=>{if(!this.storeName){s(new Error("Store name not set"));return}const o=t.transaction(this.storeName,"readonly");o.onerror=l=>s(o.error);const i=o.objectStore(this.storeName).get(e);i.onerror=l=>s(i.error),i.onsuccess=()=>{n(i.result),t.close()}})}async setItem(e,t){const n=await this.getDb();if(typeof e=="number"&&(e=e.toString()),typeof e!="string")throw new Error("Key must be a string");return new Promise((s,o)=>{if(!this.storeName){o(new Error("Store name not set"));return}const a=n.transaction(this.storeName,"readwrite");a.onerror=c=>o(a.error);const l=a.objectStore(this.storeName).put(t,e);l.onerror=c=>o(l.error),l.onsuccess=()=>{n.close(),s()}})}async removeItem(e){const t=await this.getDb();if(typeof e=="number"&&(e=e.toString()),typeof e!="string")throw new Error("Key must be a string");return new Promise((n,s)=>{if(!this.storeName){s(new Error("Store name not set"));return}const o=t.transaction(this.storeName,"readwrite");o.onerror=l=>s(o.error);const i=o.objectStore(this.storeName).delete(e);i.onerror=l=>s(i.error),i.onsuccess=()=>{t.close(),n()}})}async keys(){const e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(new Error("Store name not set"));return}const s=e.transaction(this.storeName,"readonly");s.onerror=i=>n(s.error);const a=s.objectStore(this.storeName).getAllKeys();a.onerror=i=>n(a.error),a.onsuccess=()=>{t(a.result),e.close()}})}async count(){const e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(new Error("Store name not set"));return}const s=e.transaction(this.storeName,"readonly");s.onerror=i=>n(s.error);const a=s.objectStore(this.storeName).count();a.onerror=i=>n(a.error),a.onsuccess=()=>{t(a.result),e.close()}})}async length(){return this.count()}async clear(){const e=await this.getDb();return new Promise((t,n)=>{if(!this.storeName){n(new Error("Store name not set"));return}const s=e.transaction(this.storeName,"readwrite");s.onerror=i=>n(s.error);const a=s.objectStore(this.storeName).clear();a.onerror=i=>n(a.error),a.onsuccess=()=>{e.close(),t()}})}}const O=["https://raw.githubusercontent.com/hot-dao/near-selector/refs/heads/main/repository/manifest.json","https://cdn.jsdelivr.net/gh/azbang/hot-connector/repository/manifest.json"];function K(r){return e=>Object.entries(r).every(([t,n])=>!(n&&!e.manifest.features?.[t]))}class q{storage;events;db;logger;wallets=[];manifest={wallets:[],version:"1.0.0"};features={};network="mainnet";providers={mainnet:[],testnet:[]};signInData;walletConnect;footerBranding;excludedWallets=[];autoConnect;whenManifestLoaded;constructor(e){this.db=new T("hot-connector","wallets"),this.storage=e?.storage??new y,this.events=e?.events??new b,this.logger=e?.logger,this.network=e?.network??"mainnet",this.walletConnect=e?.walletConnect,this.autoConnect=e?.autoConnect??!0,this.providers=e?.providers??{mainnet:[],testnet:[]},this.excludedWallets=e?.excludedWallets??[],this.features=e?.features??{},this.signInData=e?.signIn,e?.footerBranding!==void 0?this.footerBranding=e?.footerBranding:this.footerBranding={icon:"https://pages.near.org/wp-content/uploads/2023/11/NEAR_token.png",heading:"NEAR Connector",link:"https://wallet.near.org",linkText:"Don't have a wallet?"},this.whenManifestLoaded=new Promise(async t=>{e?.manifest==null||typeof e.manifest=="string"?this.manifest=await this._loadManifest(e?.manifest).catch(()=>({wallets:[],version:"1.0.0"})):this.manifest=e?.manifest??{wallets:[],version:"1.0.0"};const n=new Set(this.excludedWallets);n.delete("hot-wallet"),this.manifest.wallets=this.manifest.wallets.filter(s=>!(s.permissions.walletConnect&&!this.walletConnect||n.has(s.id))),await new Promise(s=>setTimeout(s,100)),t()}),typeof window<"u"&&(window.addEventListener("near-wallet-injected",this._handleNearWalletInjected),window.dispatchEvent(new Event("near-selector-ready")),window.addEventListener("message",async t=>{t.data.type==="near-wallet-injected"&&(await this.whenManifestLoaded.catch(()=>{}),this.wallets=this.wallets.filter(n=>n.manifest.id!==t.data.manifest.id),this.wallets.unshift(new x(this,t.data.manifest)),this.events.emit("selector:walletsChanged",{}),this.autoConnect&&this.connect({walletId:t.data.manifest.id}))})),this.whenManifestLoaded.then(()=>{typeof window<"u"&&window.parent.postMessage({type:"near-selector-ready"},"*"),this.manifest.wallets.forEach(t=>this.registerWallet(t)),this.storage.get("debug-wallets").then(t=>{JSON.parse(t??"[]").forEach(s=>this.registerDebugWallet(s))})})}get availableWallets(){return this.wallets.filter(t=>Object.entries(this.features).every(([n,s])=>!(s&&!t.manifest.features?.[n]))).filter(t=>!(this.network==="testnet"&&!t.manifest.features?.testnet))}_handleNearWalletInjected=e=>{this.wallets=this.wallets.filter(t=>t.manifest.id!==e.detail.manifest.id),this.wallets.unshift(new S(this,e.detail)),this.events.emit("selector:walletsChanged",{})};async _loadManifest(e){const t=e?[e]:O;for(const n of t){const s=await fetch(n).catch(()=>null);if(!(!s||!s.ok))return await s.json()}throw new Error("Failed to load manifest")}async switchNetwork(e,t){this.network!==e&&(await this.disconnect().catch(()=>{}),t&&(this.signInData=t),this.network=e,await this.connect())}async registerWallet(e){if(e.type!=="sandbox")throw new Error("Only sandbox wallets are supported");this.wallets.find(t=>t.manifest.id===e.id)||(this.wallets.push(new f(this,e)),this.events.emit("selector:walletsChanged",{}))}async registerDebugWallet(e){const t=typeof e=="string"?JSON.parse(e):e;if(t.type!=="sandbox")throw new Error("Only sandbox wallets type are supported");if(!t.id)throw new Error("Manifest must have an id");if(!t.name)throw new Error("Manifest must have a name");if(!t.icon)throw new Error("Manifest must have an icon");if(!t.website)throw new Error("Manifest must have a website");if(!t.version)throw new Error("Manifest must have a version");if(!t.executor)throw new Error("Manifest must have an executor");if(!t.features)throw new Error("Manifest must have features");if(!t.permissions)throw new Error("Manifest must have permissions");if(this.wallets.find(s=>s.manifest.id===t.id))throw new Error("Wallet already registered");t.debug=!0,this.wallets.unshift(new f(this,t)),this.events.emit("selector:walletsChanged",{});const n=this.wallets.filter(s=>s.manifest.debug).map(s=>s.manifest);return this.storage.set("debug-wallets",JSON.stringify(n)),t}async removeDebugWallet(e){this.wallets=this.wallets.filter(n=>n.manifest.id!==e);const t=this.wallets.filter(n=>n.manifest.debug).map(n=>n.manifest);this.storage.set("debug-wallets",JSON.stringify(t)),this.events.emit("selector:walletsChanged",{})}async selectWallet({features:e={}}={}){return await this.whenManifestLoaded.catch(()=>{}),new Promise((t,n)=>{const s=new j({footer:this.footerBranding,wallets:this.availableWallets.filter(K(e)).map(o=>o.manifest),onRemoveDebugManifest:async o=>this.removeDebugWallet(o),onAddDebugManifest:async o=>this.registerDebugWallet(o),onReject:()=>(n(new Error("User rejected")),s.destroy()),onSelect:o=>(t(o),s.destroy())});s.create()})}async connect(e={}){let t=e.walletId;const n=e.signMessageParams;await this.whenManifestLoaded.catch(()=>{}),t||(t=await this.selectWallet(e.signMessageParams!=null?{features:{signInAndSignMessage:!0}}:void 0));try{const s=await this.wallet(t);if(this.logger?.log("Wallet available to connect",s),await this.storage.set("selected-wallet",t),this.logger?.log(`Set preferred wallet, try to signIn${n!=null?" (with signed message)":""}`,t),n!=null){const o=await s.signInAndSignMessage({contractId:this.signInData?.contractId,methodNames:this.signInData?.methodNames,messageParams:n,network:this.network});if(!o?.length)throw new Error("Failed to sign in");this.logger?.log("Signed in to wallet (with signed message)",t,o),this.events.emit("wallet:signInAndSignMessage",{wallet:s,accounts:o,success:!0}),this.events.emit("wallet:signIn",{wallet:s,accounts:o.map(a=>({accountId:a.accountId,publicKey:a.publicKey})),success:!0,source:"signInAndSignMessage"})}else{const o=await s.signIn({contractId:this.signInData?.contractId,methodNames:this.signInData?.methodNames,network:this.network});if(!o?.length)throw new Error("Failed to sign in");this.logger?.log("Signed in to wallet",t,o),this.events.emit("wallet:signIn",{wallet:s,accounts:o,success:!0,source:"signIn"})}return s}catch(s){throw this.logger?.log("Failed to connect to wallet",s),s}}async disconnect(e){e||(e=await this.wallet()),await e.signOut({network:this.network}),await this.storage.remove("selected-wallet"),this.events.emit("wallet:signOut",{success:!0})}async getConnectedWallet(){await this.whenManifestLoaded.catch(()=>{});const e=await this.storage.get("selected-wallet"),t=this.wallets.find(s=>s.manifest.id===e);if(!t)throw new Error("No wallet selected");const n=await t.getAccounts();if(!n?.length)throw new Error("No accounts found");return{wallet:t,accounts:n}}async wallet(e){if(await this.whenManifestLoaded.catch(()=>{}),!e)return this.getConnectedWallet().then(({wallet:n})=>n).catch(async()=>{throw await this.storage.remove("selected-wallet"),new Error("No accounts found")});const t=this.wallets.find(n=>n.manifest.id===e);if(!t)throw new Error("Wallet not found");return t}async use(e){await this.whenManifestLoaded.catch(()=>{}),this.wallets=this.wallets.map(t=>new Proxy(t,{get(n,s,o){const a=Reflect.get(n,s,o);if(s in e&&typeof a=="function"){const i=e[s];return function(...l){const c=()=>a.apply(n,l);return l.length>0?i.call(this,...l,c):i.call(this,void 0,c)}}return a}}))}on(e,t){this.events.on(e,t)}once(e,t){this.events.once(e,t)}off(e,t){this.events.off(e,t)}removeAllListeners(e){this.events.removeAllListeners(e)}}exports.InjectedWallet=S;exports.LocalStorage=y;exports.NearConnector=q;exports.ParentFrameWallet=x;exports.SandboxWallet=f;exports.nearActionsToConnectorActions=h;
