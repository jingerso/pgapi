require('es6-promise').polyfill();
import React from 'react';
import ReactDOM from 'react-dom';
import { BrowserRouter } from 'react-router'
import App from './App';
import './index.css';

ReactDOM.render(
  <BrowserRouter>
    {(props) => <App {...props} />}
  </BrowserRouter>,
  document.getElementById('root')
);
