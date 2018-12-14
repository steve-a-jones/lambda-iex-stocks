const {URL} = require('url');
const https = require('https');
const R = require('ramda');

const httpsRequest = (httpConfig, httpBody) => 
    new Promise((resolve, reject)=>{
        const req = https.request(httpConfig, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                if (!!~res.headers['content-type'].indexOf('application/json')) body = JSON.parse(body);
                resolve(body);
            });
        });
        
        req.on('error', reject);
        if (httpBody) req.write(JSON.stringify(httpBody))
        req.end();
    })


const getStockData = async stockSymbol =>
    await httpsRequest({
        method:'GET',
        hostname:'api.iextrading.com',
        path:`/1.0/stock/${stockSymbol}/quote`
    })

const postToSlack = async (response_url, title, body) => {
    const {hostname, pathname} = new URL(response_url);
    await httpsRequest(
        {
            method:'POST',
            hostname,
            path:pathname,
            headers:{'Content-type':'application/json'}
        },
        {text:title, attachments:[{text:body}], response_type:'in_channel'}
    )
}

const stockDataFiltered = R.pick([
    'latestPrice', 'open', 'close', 'high', 'low', 
    'latestVolume', 'change', 'changePercent', 
    'avgTotalVolume', 'week52High', 'week52High', 
    'ytdChange', 'sector'
]);

const stockDataFormatted = R.pipe(
    stockDataFiltered,
    R.toPairs,
    R.reduce((acc, [k, v])=>`${acc}${k} : ${v}\n`, '')
)

exports.handler = async ({data:{response_url, text}}) => {
    const stockSymbol = text.toLowerCase().trim();
    const stockData = await getStockData(stockSymbol);
    await postToSlack(
        response_url,
        `${stockSymbol.toUpperCase()}`,
        stockDataFormatted(stockData)
    );
};
