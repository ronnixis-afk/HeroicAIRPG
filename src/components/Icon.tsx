import React from 'react';

interface IconProps {
  name: string;
  className?: string;
}

const iconPaths: { [key: string]: React.ReactElement } = {
    arrowLeft: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
      </svg>
    ),
    audioWave: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
    </svg>
    ),
    brain: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 0 1-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0 1 15 18.257V17.25m6-12V15a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 15V5.25m18 0A2.25 2.25 0 0 0 18.75 3H5.25A2.25 2.25 0 0 0 3 5.25m18 0V12a2.25 2.25 0 0 1-2.25 2.25H5.25A2.25 2.25 0 0 1 3 12V5.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8.25v4.5m0 0-3-3m3 3 3-3" /> 
      </svg>
    ),
    character: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
      </svg>
    ),
    chat: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
      </svg>
    ),
    check: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
      </svg>
    ),
    chevronDown: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
      </svg>
    ),
    chevronUp: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" />
      </svg>
    ),
    clipboardList: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
      </svg>
    ),
    clock: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
    ),
    close: (
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
       </svg>
    ),
    code: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
      </svg>
    ),
    copy: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5" />
        </svg>
    ),
    crossedSwords: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 18.75 18.75 5.25" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.25 18.75 18.75" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 21 6 18" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 6 21 3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 3 6 6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18 21 21" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 3l2 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 8l-5-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16l5 2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 21l-2-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l5-2" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 3l-2 5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 21l2-5" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 16l-5 2" />
      </svg>
    ),
    danger: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
      </svg>
    ),
    exclamation: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01" />
      </svg>
    ),
    download: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
      </svg>
    ),
    share: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
      </svg>
    ),
    dice: (
      <svg viewBox="0 0 511.99 511.99" xmlns="http://www.w3.org/2000/svg">
        <g><path d="m474.955 125.255-215.21-124.25c-2.32-1.34-5.18-1.34-7.5 0l-215.21 124.25c-2.32 1.34-3.75 3.815-3.75 6.495v248.5c0 2.68 1.43 5.155 3.75 6.495l215.21 124.25c2.272 1.324 5.229 1.328 7.5 0l70.43-40.66c3.587-2.071 4.816-6.658 2.745-10.245-2.071-3.588-6.658-4.816-10.245-2.745l-59.179 34.165v-81.681l173.329-18.389-83.96 48.476c-3.587 2.071-4.816 6.658-2.745 10.245 2.071-3.588-6.658-4.816 10.245-2.745l114.59-66.16c2.32-1.34 3.75-3.815 3.75-6.495v-248.5c0-2.681-1.43-5.156-3.75-6.496zm-85.906 42.32-25.108-32.519c-2.531-3.279-7.242-3.884-10.52-1.353-3.279 2.531-3.884 7.241-1.353 10.52l19.67 25.477h-231.488l115.745-149.927 75.023 97.18c2.531 3.279 7.241 3.885 10.52 1.354s3.885-7.241 1.354-10.52l-57.742-74.794 170.673 98.537zm-266.107-.001-66.774-36.045 170.672-98.536zm-7.479 13.009-31.557 76.104c-1.586 3.826.229 8.214 4.056 9.801 3.825 1.584 8.214-.229 9.801-4.056l28.342-68.353 115.99 199.983-190.538-20.211 32.836-79.188c1.586-3.826-.229-8.214-4.056-9.801-3.826-1.585-8.214.229-9.801 4.056l-22.252 53.664v-198.263zm133.033 229.244v81.684l-173.331-100.072zm7.5-21.693-117.991-203.434h235.982zm207.709-243.813v198.265l-67.175-162.003zm-77.818 49.759 74.543 179.771-190.535 20.215z" fill="currentColor"/></g>
      </svg>
    ),
    edit: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
      </svg>
    ),
    eye: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.432 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
      </svg>
    ),
    photo: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    save: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" />
      </svg>
    ),
    hammer: (
      <svg fill="currentColor" version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" xmlSpace="preserve">
        <g>
            <path d="M503.429,180.908l-15.93-15.927c-3.134-3.136-8.217-3.135-11.352,0c-3.135,3.135-3.135,8.218,0.001,11.353l15.929,15.927
                c2.505,2.503,3.883,5.833,3.883,9.374c0,3.541-1.379,6.87-3.882,9.374l-18.186,18.185l-98.397-98.397
                c-3.136-3.135-8.218-3.135-11.353,0c-3.135,3.135-3.135,8.218,0,11.352l98.397,98.397l-8.106,8.104
                c-2.503,2.503-5.832,3.882-9.373,3.882c-3.541,0-6.869-1.379-9.373-3.882l-112.66-112.659c-0.21-0.21-0.404-0.437-0.599-0.66
                c-0.128-0.151-0.257-0.302-0.398-0.481c-0.014-0.017-0.03-0.032-0.044-0.049c-0.207-0.263-0.412-0.528-0.598-0.805l-53.136-79.305
                c-3.513-5.244-2.825-12.289,1.638-16.752l11.477-11.475c4.461-4.462,11.506-5.154,16.751-1.64l79.307,53.138
                c0.714,0.477,1.384,1.03,1.993,1.639l75.188,75.188c3.136,3.135-8.218,3.135,11.354,0c3.135-3.135,3.135-8.218,0-11.353
                l-75.188-75.188c-1.348-1.346-2.832-2.567-4.411-3.624l-79.306-53.137c-11.592-7.768-27.172-6.245-37.041,3.624l-11.477,11.474
                c-9.868,9.868-11.393,25.447-3.623,37.042l50.269,75.024L65.813,358.606c-3.265,3-3.48,8.078-0.479,11.342
                c2.998,3.263,8.077,3.479,11.342,0.479L315.4,151.067l38.99,38.99L85.409,482.778c-3.812,4.149-9.014,6.499-14.646,6.618
                c-5.607,0.131-10.928-2.009-14.913-5.994l-33.797-33.797c-3.985-3.984-6.113-9.28-5.994-14.913
                c0.119-5.633,2.469-10.835,6.618-14.647l31.509-28.954c3.266-3,3.48-8.078-0.48-11.342c-2.998,3.263,8.079,3.479,11.342-0.479
                l-31.509,28.954c-7.401,6.801-11.594,16.079-11.807,26.13c-0.212,10.049,3.586,19.497,10.691,26.605l33.797,33.797
                c6.92,6.919,16.056,10.701,25.807,10.7c0.265,0,0.532-0.002,0.798-0.009c10.049-0.212,19.329-4.405,26.129-11.806L365.751,201.42
                l58.583,58.583c5.716,5.714,13.22,8.572,20.726,8.571c7.505-0.001,15.011-2.858,20.726-8.571l37.643-37.642
                C514.857,210.932,514.857,192.336,503.429,180.908z"/>
        </g>
      </svg>
    ),
    info: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
      </svg>
    ),
    inventory: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
      </svg>
    ),
    lightbulb: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-4.5 4.5 4.5 0 0 0-9 0 6.01 6.01 0 0 0 1.5 4.5m0 0a1.5 1.5 0 0 0 3 0m-6 5.25h6m-6 2.25h6" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75h6" />
      </svg>
    ),
    location: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
      </svg>
    ),
    map: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498 4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 0 0-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0Z" />
      </svg>
    ),
    menu: (
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
      </svg>
    ),
    boxDrawer: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 13.5h3.86a2.25 2.25 0 0 1 2.012 1.244l.256.512a2.25 2.25 0 0 0 2.013 1.244h3.218a2.25 2.25 0 0 0 2.013-1.244l.256-.512a2.25 2.25 0 0 1 2.013-1.244h3.859m-19.5.338V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18v-4.162c0-2.24-1.8-4.038-4.045-4.038H6.295c-2.245 0-4.045 1.799-4.045 4.038Z" />
      </svg>
    ),
    squaresPlus: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
      </svg>
    ),
    microphone: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" />
      </svg>
    ),
    minus: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
      </svg>
    ),
    play: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
      </svg>
    ),
    plus: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
      </svg>
    ),
    refresh: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 11.664 0l3.181-3.183m-11.664 0-3.181 3.183m0 0-3.181-3.183m11.664 0-3.181-3.183" />
        </svg>
    ),
    rocket: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
    search: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
        </svg>
    ),
    send: (
       <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
         <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
       </svg>
    ),
    settings: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286Zm0 13.036h.008v.008h-.008v-.008Z" />
      </svg>
    ),
    shield: (
        <svg fill="currentColor" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
            <path d="M5.338 1.59a61.44 61.44 0 0 0-2.837.856.481.481 0 0 0-.328.39c-.554 4.157.726 7.19 2.253 9.188a10.725 10.725 0 0 0 2.287 2.233c.346.244.652.42.893.533.12.057.218.095.293.118a.55.55 0 0 0 .101.025.615.615 0 0 0 .1-.025c.076-.023.174-.061.294-.118.24-.113.547-.29.893-.533a10.726 10.726 0 0 0 2.287-2.233c1.527-1.997 2.807-5.031 2.253-9.188a.48.48 0 0 0-.328-.39c-.651-.213-1.75-.56-2.837-.855C9.552 1.29 8.531 1.067 8 1.067c-.53 0-1.552.223-2.662.524zM5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.775 11.775 0 0 1-2.517 2.453 7.159 7.159 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7.158 7.158 0 0 1-1.048-.625 11.777 11.777 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 62.456 62.456 0 0 1 5.072.56z"/>
            <path d="M8 4.5a.5.5 0 0 1 .5.5v1.5H10a.5.5 0 0 1 0 1H8.5V9a.5.5 0 0 1-1 0V7.5H6a.5.5 0 0 1 0-1h1.5V5a.5.5 0 0 1 .5-.5z"/>
        </svg>
    ),
    shoppingBag: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 1 0-7.5 0v4.5m11.356-1.993 1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 0 1-1.12-1.243l1.264-12A1.125 1.125 0 0 1 5.513 7.5h12.974c.576 0 1.059.435 1.119 1.007ZM8.625 10.5a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm7.5 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
      </svg>
    ),
    currencyCoins: (
      <svg viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg" className="fill-none">
        <g fill="none" fillRule="evenodd" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" transform="translate(1 3)">
          <path d="m17.5 8.5v3c0 1.2994935-3.1340068 3-7 3-3.86599325 0-7-1.7005065-7-3 0-.4275221 0-1.2608554 0-2.5"/>
          <path d="m3.79385803 9.25873308c.86480173 1.14823502 3.53999333 2.22489962 6.70614197 2.22489962 3.8659932 0 7-1.60524016 7-2.98595204 0-.77476061-.9867994-1.62391104-2.5360034-2.22001882"/>
          <path d="m14.5 3.5v3c0 1.29949353-3.1340068 3-7 3-3.86599325 0-7-1.70050647-7-3 0-.64128315 0-2.35871685 0-3"/>
          <path d="m7.5 6.48363266c3.8659932 0 7-1.60524012 7-2.985952 0-1.38071187-3.1340068-2.99768066-7-2.99768066-3.86599325 0-7 1.61696879-7 2.99768066 0 1.38071188 3.13400675 2.985952 7 2.985952z"/>
        </g>
      </svg>
    ),
    skull: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM9 10.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm9 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Zm-9.375 6.75a.75.75 0 0 1 .75-.75h4.5a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1-.75-.75Z" />
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="0.1" /> 
      </svg>
    ),
    sparkles: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
      </svg>
    ),
    spinner: (
      <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    ),
    story: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
      </svg>
    ),
    store: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5A.75.75 0 0 1 14.25 12h.01a.75.75 0 0 1 .75.75v7.5m0-7.5h.01M16.5 21v-7.5A.75.75 0 0 0 15.75 12h.01a.75.75 0 0 0 .75.75v7.5m0-7.5h.01M4.5 21v-7.5A.75.75 0 0 1 5.25 12h.01a.75.75 0 0 1 .75.75v7.5m0-7.5h.01M7.5 21v-7.5A.75.75 0 0 0 6.75 12h.01a.75.75 0 0 0 .75.75v7.5m0-7.5h.01M10.5 21v-7.5A.75.75 0 0 0 9.75 12h.01a.75.75 0 0 0 .75.75v7.5m0-7.5h.01M18 19.5h-12c-1.381 0-2.5-1.119-2.5-2.5V8.663a1 1 0 0 1 .223-.627l1.246-1.557a1 1 0 0 1 .777-.373h10.51c.318 0 .621.124.848.344l1.479 1.361a1 1 0 0 1 .271.753v9.428c0 .414-.168.79-.469 1.071-.299.28-.691.429-1.091.429Zm-12-12.5v9.5c0 .552.448 1 1 1h12c.552 0 1-.448 1-1V8.663a1 1 0 0 1-.223-.627l-1.246-1.557a1 1 0 0 1-.777-.373H8.348a1 1 0 0 1-.848-.344L6.021 4.361a1 1 0 0 1-.271-.753V3.5c0-.276-.224-.5-.5-.5H3.5c-.276 0-.5.224-.5.5v1c0 .276.224.5.5.5h1.5Z" />
      </svg>
    ),
    sword: (
      <svg version="1.1" viewBox="0 0 510.393 510.393" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
        <path d="M473.929,443.781l-61.006-61.006c20.193-23.994,34.821-50.539,36.986-72.686c1.146-11.726-7.431-22.161-19.157-23.308s-22.161,7.431-23.308,19.157c-0.274,2.806-0.97,5.822-2.02,8.99l-59.715-59.711l128.212-128.231c2.34-2.341,4.104-5.194,5.151-8.333l30.187-90.496c5.563-16.678-10.303-32.548-26.982-26.99L391.76,31.333c-3.142,1.047-5.998,2.812-8.34,5.154L255.197,164.711L126.972,36.495c-2.341-2.341-5.195-4.105-8.335-5.152L28.119,1.156C11.44-4.406-4.43,11.464,1.133,28.143l30.187,90.517c1.047,3.141,2.811,5.994,5.152,8.335L164.687,255.22l-59.981,59.981c-0.947-3.009-1.532-5.854-1.692-8.477c-0.713-11.76-10.826-20.716-22.586-20.002c-11.76,0.714-20.716,10.826-20.002,22.586c0.968,15.948,8.92,34.408,21.056,52.607c0.126,0.2,0.237,0.407,0.371,0.604c0.458,0.677,0.942,1.352,1.411,2.027c0.003,0.004,0.006,0.008,0.008,0.012c0.812,1.17,1.633,2.338,2.478,3.504c0.74,1.026,1.492,2.05,2.256,3.072c0.21,0.281,0.42,0.561,0.633,0.841c2.77,3.67,5.691,7.306,8.741,10.888L36.465,443.78c-8.331-8.33-21.838-8.33-30.169,0.001c-8.331,8.331-8.331,21.839,0,30.17l14.936,14.936c0.049,0.05,0.091,0.106,0.141,0.156s0.105,0.091,0.156,0.141l14.934,14.934c8.331,8.331,21.839,8.331,30.17,0c8.33-8.33,8.331-21.835,0.003-30.166l61.006-61.006c23.995,20.193,50.54,34.822,72.687,36.987c11.726,1.146,22.161-7.431,23.308-19.157c1.146-11.726-7.431-22.161-19.157-23.308c-2.808-0.274-5.826-0.971-8.997-2.022l59.705-59.719l59.984,59.988c-3.005,0.945-5.847,1.529-8.467,1.688c-11.76,0.713-20.716,10.826-20.002,22.586c0.714,11.76,10.826,20.716,22.586,20.002c15.989-0.97,34.502-8.962,52.746-21.15c0.143-0.092,0.292-0.17,0.434-0.266c0.53-0.358,1.058-0.738,1.587-1.103c0.534-0.366,1.068-0.739,1.601-1.113c0.565-0.397,1.13-0.785,1.694-1.19c1.3-0.929,2.595-1.884,3.889-2.852c0.209-0.157,0.417-0.313,0.626-0.471c3.701-2.79,7.369-5.735,10.981-8.811l60.916,60.916c-8.331,8.331-8.331,21.839,0,30.17c8.331,8.331,21.839,8.331,30.17,0l14.958-14.958c0.043-0.042,0.09-0.077,0.133-0.12s0.078-0.09,0.12-0.133l14.954-14.954c8.331,8.331,8.331-21.839,0-30.17C495.765,435.456,482.261,435.454,473.929,443.781z M410.029,70.219l45.253-15.081l-15.091,45.24L315.539,225.049l-30.171-30.169L410.029,70.219z M55.111,55.135l45.252,15.091l139.565,139.555c0.062,0.064,0.114,0.133,0.177,0.196l60.352,60.331c0.006,0.006,0.012,0.011,0.018,0.016l82.127,82.121c-4.599,5.682-9.599,11.241-14.867,16.509c-4.933,4.933-10.019,9.548-15.186,13.8l-82.221-82.227c-0.02-0.02-0.036-0.042-0.056-0.062l-60.331-60.331c-0.006-0.006-0.012,0.01,0.017-0.016L70.202,100.387L55.111,55.135z M157.964,382.623c-4.219-3.415-8.383-7.063-12.42-10.884c-0.021-0.02-0.042-0.04-0.063-0.061c-1.138-1.078-2.261-2.176-3.377-3.281c-0.34-0.336-0.678-0.673-1.015-1.011c-4.825-4.872-9.294-9.801-13.419-14.809l67.186-67.186l30.161,30.164L157.964,382.623z"/>
      </svg>
    ),
    target: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.82m5.84-2.56a12.025 12.025 0 0 1-4.04 4.04m0 0a12.025 12.025 0 0 1-4.04-4.04m4.04 4.04v3.31m-4.04-4.04a12.025 12.025 0 0 1 4.04-4.04m0 0a6 6 0 0 1-5.84-7.38v4.82m5.84 2.56a12.025 12.025 0 0 1 4.04 4.04m0 0a12.025 12.025 0 0 1 4.04 4.04m-4.04-4.04v-3.31" />
      </svg>
    ),
    trash: (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.134-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.067-2.09 1.02-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
    ),
    users: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
      </svg>
    ),
    world: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-.778.099-1.533.284-2.253" />
      </svg>
    ),
    star: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
      </svg>
    ),
    starFill: (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.007 5.404.433c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.433 2.082-5.006z" clipRule="evenodd" />
      </svg>
    ),
};

export const Icon = ({ name, className = 'w-6 h-6' }: IconProps) => {
  const icon = iconPaths[name];

  if (icon) {
      return React.cloneElement(icon as React.ReactElement<any>, { className });
  }
  
  return <div />;
};