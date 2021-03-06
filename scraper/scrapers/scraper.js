const cheerio = require('cheerio');
const axios = require('axios');

const { handleQueries, handleFirst } = require('./mongoHandler');
const { getRandomInt } = require('./helpers');

const mongoFuncs = {
  handleQueries,
  handleFirst,
};

// iterate matching dom elements, checking if break condition
// if break condition, break loop and return false
// if not break condition, callback on element
const iterateDom = async ($, config, mongoCallBacks, page) => {
  let fullIterate = true;
  let iterateCheck = false;
  const promiseArr = [];

  const domElements = $(config.iterateDomEle);
  // filter out non-number keys
  const domElementsKeys = Object.keys(domElements).filter(key => (
    Number(key) || key === '0'
  ));

  for (let i = 0; i < domElementsKeys.length; i += 1) {
    const el = domElements[i];
    const data = config.extractFunc(i, el, $);
    const { source, type } = config;

    if (!i) iterateCheck = true;
    if (config.breakVal) {
      if (`${data.title} ${data.latest}` === config.breakVal) {
        fullIterate = false;
        break;
      }
    }
    if (!i && type === 'latest' && page === 1) {
      promiseArr.push(mongoCallBacks.handleFirst(data, type, source));
    }
    promiseArr.push(mongoCallBacks.handleQueries(data, type, source));
  }
  try {
    await Promise.all(promiseArr);
  } catch (err) {
    console.error(err);
  }
  return fullIterate && iterateCheck;
};

const scraper = async (config, db, page = 1, errors = []) => {
  // change number when only scraping for latest
  if (errors.length === 30) {
    console.error(errors);
    return;
  }
  const currUrl = config.genUrlFunc(page);
  console.log('making fetch request');
  try {
    const result = await axios.get(currUrl);
    const parsedResult = cheerio.load(result.data);
    console.log('fetch request success for page', page);
    const fullIterate = await iterateDom(parsedResult, config, mongoFuncs, page);
    console.log('finished iteration', page);
    if (fullIterate && config.iterateCheck(parsedResult)) {
      setTimeout(() => {
        scraper(config, db, page + 1);
      }, getRandomInt(7000, 15000));
    } else {
      console.log('end loop condition met, closing db connection');
      db.close();
    }
  } catch (err) {
    console.error(err.message);
    errors.push(err.message);
    setTimeout(() => {
      scraper(config, db, page);
    }, getRandomInt(10000, 20000));
  }
};

module.exports = {
  iterateDom,
  scraper,
};
