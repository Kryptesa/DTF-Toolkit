// ==UserScript==
// @name         DTF Messenger
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  DTF messenger
// @author       Kryptesa
// @homepageURL  https://dtf.ru/u/13874
// @icon         https://leonardo.osnova.io/205dad5a-cf71-5b91-996c-51c826dea494/-/preview/400x/
// @match        https://dtf.ru/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

const IFRAME_HEIGHT = 1072; //px
const IFRAME_HEIGHT_TRANSITION_SPEED = 250; //ms

const IFRAME_SRC = 'https://dtf.ru/m';
const IFRAME_ID = 'direct-iframe';

const AppMessage = {
  UnreadMessageCountUpdated: 'UnreadMessageCountUpdated',
  UnreadMessageCountIncreased: 'UnreadMessageCountIncreased',
};

const Store = class {
  _eventListeners = {
    iFrameShown: [],
    iFramePosition: [],
    unreadCount: [],
    unreadMessageCount: [],
  };

  _iFrameShown = false;

  _iFramePosition = {
    x: 0,
    y: 0,
  };

  _unreadMessageCount = 0;

  constructor({ iFrameShown, iFramePosition, unreadMessageCount }) {
    this._iFrameShown = iFrameShown;
    this._iFramePosition = iFramePosition;
    this._unreadMessageCount = unreadMessageCount;
  }

  get iFrameShown() {
    return this._iFrameShown;
  }

  set iFrameShown(value) {
    if (this._iFrameShown !== value) {
      this._iFrameShown = value;

      this._eventListeners.iFrameShown.map(callback => callback(value));
    }
  }

  get iFramePosition() {
    return this._iFramePosition;
  }

  set iFramePosition(coords) {
    if (coords.x !== this._iFramePosition.x || coords.y !== this._iFramePosition.y) {
      this._iFramePosition = coords;

      this._eventListeners.iFramePosition.map(callback => callback(coords));
    }
  }

  get unreadMessageCount() {
    return this._unreadMessageCount;
  }

  set unreadMessageCount(value) {
    if (this._unreadMessageCount !== value) {
      this._unreadMessageCount = value;

      this._eventListeners.unreadMessageCount.map(callback => callback(value));
    }
  }

  addEventListener(propertyName, callback, runImmediately = false) {
    this._eventListeners[propertyName].push(callback);

    runImmediately && callback(this[propertyName]);
  }
};

const iFrameStyles = `
    html {
        overflow: hidden;
    }

    #app {
        padding: 0;
    }

    .bar--bottom,.bar--top {
        display: none;
    }

    .view > div {
        height: ${IFRAME_HEIGHT}px;
        overflow-x: hidden;
        overscroll-behavior: contain;
    }

    .view > div::before { 
        content: '';
        display: block;
        height: 1px;
        top: 0;
        z-index: -1;
    }
`;

const chatStyles = `
    #direct-iframe, #direct-button {
        position: fixed;
        height: 0;
        width: 500px;
        transition: height ${IFRAME_HEIGHT_TRANSITION_SPEED}ms;
        z-index: 9999;
    }

    #direct-iframe.direct-iframe--shown {
        height: var(--direct-iframe-height);
        visibility: visible;
    }

    #direct-iframe.direct-iframe--hidden {
        visibility: hidden;
    }
`;

function addStyle(styleText) {
  const stylesheet = document.createElement('style');
  stylesheet.appendChild(document.createTextNode(styleText));

  document.head.appendChild(stylesheet);
}

async function initIFrame() {
  const header = document.querySelector('.header__layout');
  const targetButtonWrapper = header.querySelector('.bell');

  const store = new Store({
    iFrameShown: false,
    iFramePosition: {
      x: targetButtonWrapper.getBoundingClientRect().x,
      y: targetButtonWrapper.getBoundingClientRect().y,
    },
    unreadMessageCount: 0,
  });

  addStyle(chatStyles);

  const iFrame = document.createElement('iframe');
  iFrame.src = IFRAME_SRC;
  iFrame.id = IFRAME_ID;
  iFrame.classList = 'notifications-popover direct-iframe--hidden';

  document.body.appendChild(iFrame);
  document.body.style = `--direct-iframe-height: ${IFRAME_HEIGHT}px`;

  const toggleIFrame = (state = null) => store.iFrameShown = state ?? !store.iFrameShown;

  const chatButtonWrapper = targetButtonWrapper.cloneNode(true);
  const chatButton = chatButtonWrapper.querySelector('button');

  chatButton.innerHTML = '<svg class="icon bell__button-icon icon--messenger" style="transform: none; pointer-events: none;" width="24" height="24"><use xlink:href="#messenger"></use></svg>';
  chatButton.onclick = toggleIFrame;

  const counterElement = document.createElement('div');
  counterElement.classList = 'counter-label bell__unread-count';
  counterElement.style = 'pointer-events: none;';

  header.querySelector('.header__right').prepend(chatButtonWrapper);

  store.addEventListener(
    'iFrameShown',
    iFrameShown => {
      if (iFrameShown) {
        chatButtonWrapper.querySelector('button').classList.add('bell__button--active');

        iFrame.classList.remove('direct-iframe--hidden');
        iFrame.classList.add('direct-iframe--shown');
      } else {
        chatButtonWrapper.querySelector('button').classList.remove('bell__button--active');

        iFrame.classList.remove('direct-iframe--shown');

        setTimeout(() => iFrame.classList.add('direct-iframe--hidden'), IFRAME_HEIGHT_TRANSITION_SPEED - 50);
      }
    },
  );

  store.addEventListener(
    'iFramePosition',
    ({ x, y }) => iFrame.style = `top: calc(${y}px + 50px); left: calc(${x}px - 250px);`,
    true,
  );

  store.addEventListener(
    'unreadMessageCount',
    unreadMessageCount => {
      try {
        counterElement.innerHTML = unreadMessageCount;

        if (unreadMessageCount > 0) {
          chatButton.appendChild(counterElement);
        } else {
          chatButton.removeChild(counterElement);
        }
      } catch { /*ignore*/ }
    },
    true,
  );

  window.addEventListener(
    'message',
    ({ data }) => {
      switch (data.type) {
        case AppMessage.UnreadMessageCountIncreased: {
          store.unreadMessageCount += 1;

          break;
        }

        case AppMessage.UnreadMessageCountUpdated: {
          store.unreadMessageCount = data.unreadMessageCount;

          break;
        }
      }
    },
  );

  const OriginalWebsocket = window.WebSocket;
  const ProxiedWebSocket = function () {
    const ws = new OriginalWebsocket(...arguments);

    ws.addEventListener("message", function (event) {
      if (event.data.startsWith(42)) {
        const [, rawData] = JSON.parse(event.data.slice(2));

        if (rawData.channel.startsWith('m:')) {
          switch (rawData.data.action) {
            case 'counterChanged': {
              if (!store.iFrameShown) {
                iFrame.contentWindow.postMessage({ type: AppMessage.UnreadMessageCountUpdated });
              }

              break;
            }
          }
        }
      }
    });
    return ws;
  };
  window.WebSocket = ProxiedWebSocket;

  document.body.onmousedown = ({ target }) => {
    if (target !== chatButton) {
      toggleIFrame(false);
    }
  };
}

(function () {
  'use strict';

  if (window !== window.parent) {
    const chatContent = document.body.querySelector('.view > div');

    addStyle(iFrameStyles);

    document.body.onkeydown = event => {
      switch (event.code) {
        case 'Escape': {
          chatContent.querySelector('.view a[href="/m"]')?.click();
        }
      }
    };

    const { fetch: origFetch } = window;
    window.fetch = async (...args) => {
      let response;

      try {
        response = await origFetch(...args);

        if (args[0].startsWith('https://api.dtf.ru/v2.1/m/channels')) {
          const { result } = await response.clone().json();
          const unreadMessageCount = result.channels.reduce((acc, member) => acc += member.unreadCount, 0);

          window.parent.postMessage({ type: AppMessage.UnreadMessageCountUpdated, unreadMessageCount });

        }
      } catch { /*ignore*/ }

      return response;
    };

    const OriginalWebsocket = window.WebSocket;
    const ProxiedWebSocket = function () {
      const ws = new OriginalWebsocket(...arguments);

      ws.addEventListener("message", function (event) {
        if (event.data.startsWith(42)) {
          const [, rawData] = JSON.parse(event.data.slice(2));

          if (rawData.channel.startsWith('m:')) {
            switch (rawData.data.action) {
              case 'counterChanged': {
                window.parent.postMessage({ type: AppMessage.UnreadMessageCountUpdated, unreadMessageCount: rawData.data.counter });

                break;
              }

              case 'addMessage': {
                window.parent.postMessage({ type: AppMessage.UnreadMessageCountIncreased });

                break;
              }
            }
          }
        }
      });
      return ws;
    };
    window.WebSocket = ProxiedWebSocket;

    window.addEventListener(
      'message',
      ({ data }) => {
        switch (data.type) {
          case AppMessage.UnreadMessageCountUpdated: {
            window.location.href += '';

            break;
          }
        }
      },
    );

    return;
  }

  initIFrame();
})();
