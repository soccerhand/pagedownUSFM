// NOTE: This is just a demo -- in a production environment,
// be sure to spend a few more thoughts on sanitizing user input.
// (also, you probably wouldn't use a get request)

var http = require("http"),
    url = require("url"),
    querystring = require("querystring"),
    //Converter = require("../../USFM.Converter").Converter,
    //conv = new Converter(),
    Decoder = require("../../USFMTagDecoder").Decoder,
    decoder = new Decoder(),
    getSanitizingConverter = require("../../Markdown.Sanitizer").getSanitizingConverter,
    saneConv = getSanitizingConverter();

http.createServer(function (req, res) {

    var route = url.parse(req.url);
    if (route.pathname !== "/") {
        res.writeHead(404);
        res.end("Page not found");
        return;
    }

    var query = querystring.parse(route.query);

    res.writeHead(200, { "Content-type": "text/html" });
    res.write("<html><body>");

    var markdown = query.md || "\\c 1 \\s1 Heading \\v 1 Verse1 \\v 2 Verse2";

    res.write(
        "<h1>Enter USFMy</h1>\n" +
        "<form method='get' action='/'>" +
            "<textarea cols=50 rows=10 name='md'>" +
                markdown.replace(/</g, "&lt;") +
            "</textarea><br>" +
            "<input type='submit' value='Convert!'>" +
        "</form>"
    );

    //res.write("<h1>Your output, sanitized:</h1>\n" + saneConv.makeHtml(markdown))
    //res.write("<h1>Your output:</h1>\n" + conv.makeHtml(markdown))
    res.write("<h1>Your output:</h1>\n");

    res.write(decoder.decode(markdown));


    res.end("</body></html>");

}).listen(8000);
