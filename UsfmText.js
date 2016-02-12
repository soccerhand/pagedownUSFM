"use strict";
var UsfmText;

if (typeof exports === "object" && typeof require === "function") // we're in a CommonJS (e.g. Node.js) module
    UsfmText = exports;
else
    UsfmText = {};

/**
 * Copyright (c) 2011 Rusmin Soetjipto
 * Ported to Dokuwiki by Yvonne Lu
 *
 * 1/30/14 the following functions are ported
 *  renderGeneralCommand
 *  switchListLevel
 *  setAlternateChapterNumber
 *  setPublishedChapterNumber
 *  setAlternateVerseNumber
 *  all functions from the original UsfmText.php should be ported
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of that software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and that permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * 7-25-14 Yvonne Lu
 * changed function newAnchorLabel to generate number instead of letter labels
 *
 * 8-6-14 Yvonne Lu
 * commented out some code related to is_verse_popups_extension_available
 *
 * 8-8-14 Yvonne Lu
 * generating footnote number starting at 1 instead of 0
 *
 * 1-14-15 YvonneLu
 * Added popup window for footnotes
 *
 * 3-18-15 Yvonne Lu
 * Took out link to stylesheet in getAndClearHtmlText.  It should take place
 * in the header.
 *
 */
/* yil porting notes:
 * parser needs to do:
 * recursiveTagParse
 */
(function() {

    let php = require('phpjs');
    let UsfmParagraphState = require('./UsfmParagraphState.js');

    const BIBLE_VERSE_REFERENCE_PATTERN_1 = "/\\b([1-3]\\s)?[A-Z][a-z]+\\.?\\s\\d+([\\:\\.]\\d+)?([\\-\\~]\\d+)?";
    const BIBLE_VERSE_REFERENCE_PATTERN_2 = "([\\;\\,]\\s?\\d+([\\:\\.]\\d+)?([\\-\\~]\\d+)?)*/";

    UsfmText.BodyOrFooter = function() {
        this.html_text = '';
        this.is_verse_popups_extension_available = false;

        let that = this;

        this.printHtmlText = function(html_text) {
            //echo "&quothtml_text&quot<br>";
            that.html_text += html_text;
            /*
            final_text = '';
            if (that.is_verse_popups_extension_available) {
              //global wgOut;
              while (preg_match(BIBLE_VERSE_REFERENCE_PATTERN_1.
                                BIBLE_VERSE_REFERENCE_PATTERN_2,
                                html_text, matches, PREG_OFFSET_CAPTURE))
              {
                  reference_text = "<vs>".matches[0][0]."</vs>";
                final_text += substr(html_text, 0, matches[0][1]).
                               that.parser.recursiveTagParse(reference_text);
                html_text = substr(html_text,
                                    matches[0][1] + strlen(matches[0][0]));
              }
            }
            final_text = str_replace("~", "&nbsp;", final_text.html_text);
            that.html_text += final_text;*/
        }
        this.getAndClearHtmlText = function() {
            let result          = that.html_text;
            that.html_text = '';
            return result;
        }
    }

    const IS_HEADER = 0;
    const IS_RIGHT_ALIGNED = 1;
    const CONTENT_TEXT = 2;

    const INDENT_LEVEL = 0;
    const IS_ITALIC = 1;
    const ALIGNMENT = 2;
    const PARAGRAPH_CLASS = 3;

    UsfmText.Text = function() {
        this.book_name = '';
        this.is_book_started = false;
        this.latest_chapter_number = 0;
        this.chapter_label = '';
        this.chapter_number = '';
        this.alternate_chapter_number = '';
        this.published_chapter_number = '';
        this.is_current_chapter_using_label = false;
        this.verse_number = '';
        this.alternate_verse_number = '';
        this.table_data = [];
        this.is_in_table_mode = false;
        this.paragraph_state;
        this.body;
        this.footer;
        this.is_in_footer_mode = false;
        this.anchor_count = -1;
        this.flush_paragraph_settings = {
            "default" : "usfm-flush"
        };
        this.drop_cap_numeral_settings = {
            "usfm-indent" : "usfm-c-indent",
            "default"     : "usfm-c"
        };
        this.pre_chapter_paragraph_classes =
            ["usfm-desc"];
        this.default_paragraph =
            [0, false, 'justify', 'usfm-indent'];

        this.paragraph_state = new UsfmParagraphState.ParagraphState();
        this.body            = new UsfmText.BodyOrFooter(); //yil no parser for now
        this.footer          = new UsfmText.BodyOrFooter(); //yil no parser for now

        let that = this;

        // private
        function getSetting(key, settings) {
            if(php.array_key_exists(key, settings)) {
                return settings[key];
            }
            else {
                return settings["default"];
            }
        }
        // 10 NOV 2015, Phil Hopper, Issue #368: This is causing an error and is not currently needed on door43.org
        //    function setChapterLabel(chapter_label) {
        //        if((that.chapter_number != '') ||
        //            (that.alternate_chapter_number != '') ||
        //            (that.published_chapter_number != '') ||
        //            (that.is_book_started)
        //        ) {
        //            that.chapter_label                  = chapter_label;
        //            that.is_current_chapter_using_label = true;
        //        }
        //        else {
        //            that.setBookName(chapter_label);
        //        }
        //    }
        this.setChapterNumber = function(chapter_number) {
            that.chapter_number        = chapter_number;
            that.latest_chapter_number = chapter_number;
        }
        this.setAlternateChapterNumber = function(alternate_chapter_number) {
            that.alternate_chapter_number = alternate_chapter_number;
        }
        this.setPublishedChapterNumber = function(published_chapter_number) {
            that.published_chapter_number = published_chapter_number;
        }
        //private
        function getFullChapterNumber() {
            if(that.chapter_number && that.alternate_chapter_number) {
                return that.chapter_number + "(" .
                that.alternate_chapter_number + ")";
            }
            else if(that.chapter_number) {
                return that.chapter_number;
            }
            else {
                return that.alternate_chapter_number;
            }
        }
        //private
        function isDropCapNumeralPending() {
            return (that.published_chapter_number != '') ||
            (getFullChapterNumber() != '');
        }
        this.flushPendingDropCapNumeral = function(is_no_break) {
            let final_chapter_number = that.published_chapter_number ?
                that.published_chapter_number :
                getFullChapterNumber();
            if(final_chapter_number) {
                that.chapter_number           = '';
                that.alternate_chapter_number = '';
                that.published_chapter_number = '';
                if(is_no_break || ((!that.book_name) &&
                        (!that.is_current_chapter_using_label))
                ) {
                    let drop_cap_numeral_class =
                        getSetting(
                            that.paragraph_state.getParagraphClass(),
                            that.drop_cap_numeral_settings
                        );
                    that.body
                        .printHtmlText(
                            "<span class='" + drop_cap_numeral_class + "'>" +
                            "<big class='usfm-c'><big class='usfm-c'>" +
                            "<big class='usfm-c'><big class='usfm-c'>" +
                            final_chapter_number +
                            "</big></big></big></big></span>"
                        );
                }
            }
            that.is_current_chapter_using_label = false;
        }
        //private
        function flushPendingChapterLabel() {
            if(that.chapter_label) {
                that.body
                    .printHtmlText(
                        that.paragraph_state
                            .printTitle(
                                false, 3, false,
                                that.chapter_label
                            )
                    );
                that.chapter_label = '';
            }
            else if(that.book_name) {
                label_text = that.book_name + " " .
                    getFullChapterNumber();
                that.body.printHtmlText(
                    that.paragraph_state
                        .printTitle(
                            false, 3, false,
                            label_text
                        )
                );
            }
        }
        this.printTitle = function(level, is_italic, content) {
            that.body.printHtmlText(
                that.paragraph_state
                    .closeParagraph()
            );
            flushPendingChapterLabel();
            that.body.printHtmlText(
                that.paragraph_state
                    .printTitle(
                        false, level,
                        is_italic,
                        content
                    )
            );
        }
        this.switchParagraph = function(new_indent_level, is_italic, alignment, paragraph_class) {
            that.body.printHtmlText(
                that.paragraph_state
                    .closeParagraph()
            );
            flushPendingChapterLabel();
            let is_pre_chapter_paragraph =
                (false !== php.array_search(
                        paragraph_class,
                        that.pre_chapter_paragraph_classes
                    ));
            /* yil commented out debug statement
            wfDebug("switchParagraph: ".(is_pre_chapter_paragraph ? "T" : "F").
                    " ".paragraph_class."\n");*/
            if((!is_pre_chapter_paragraph) &&
                isDropCapNumeralPending()
            ) {
                paragraph_class =
                    getSetting(
                        that.paragraph_state.getParagraphClass(),
                        that.flush_paragraph_settings
                    );
            }
            that.body.printHtmlText(
                that.paragraph_state
                    .switchParagraph(
                        new_indent_level,
                        is_italic,
                        alignment,
                        paragraph_class
                    )
            );
            if(!is_pre_chapter_paragraph) {
                that.flushPendingDropCapNumeral(false);
            }
        }
        this.setVerseNumber = function(verse_number) {
            that.verse_number = verse_number;
        }
        this.setAlternateVerseNumber = function(alternate_verse_number) {
            that.alternate_verse_number = alternate_verse_number;
        }
        //private
        function flushPendingVerseInfo() {
            if((that.alternate_verse_number != '') ||
                (that.verse_number != '')
            ) {
                if(!that.paragraph_state.isOpen()) {
                    that.switchParagraph(
                        that.default_paragraph[INDENT_LEVEL],
                        that.default_paragraph[IS_ITALIC],
                        that.default_paragraph[ALIGNMENT],
                        that.default_paragraph[PARAGRAPH_CLASS]
                    );
                }
                let anchor_verse = that.verse_number ? that.verse_number :
                    that.alternate_verse_number;
                let verse_label;
                if((that.alternate_verse_number != '') &&
                    (that.verse_number != '')
                ) {
                    verse_label = that.verse_number + " (" + that.alternate_verse_number + ")";
                }
                else {
                    verse_label = anchor_verse;
                }
                that.body.printHtmlText(
                    " <span class='usfm-v'><b class='usfm'>" +
                    "<a name='" + that.latest_chapter_number + "_" +
                    anchor_verse + "'></a>" + verse_label +
                    "</b></span>"
                );
                that.verse_number           = '';
                that.alternate_verse_number = '';
            }
        }
        this.insertTableColumn = function(is_header, is_right_aligned, text) {
            //yil commented out debug statement
            //wfDebug("inserting table column: ".text."\n");
            that.table_data.push([
                is_header, is_right_aligned,
                text
            ]);
        }
        this.flushPendingTableColumns = function() {
            if(!that.is_in_table_mode) {
                that.is_in_table_mode = true;
                that.body.printHtmlText("\n<table class='usfm'>");
            }
            if(count(that.table_data) > 0) {
                that.body.printHtmlText("\n<tr class='usfm'>");
                that.table_data.forEach(function(data) {
                    html_text =
                        "\n<td class='usfm-" + (data[IS_HEADER] ? 'th' : 'tc') +
                        (data[IS_RIGHT_ALIGNED] ? "' align='right" : "") +
                        "'>" + data[CONTENT_TEXT] + "</td>\n";
                    that.body.printHtmlText(html_text);
                });
                that.table_data = [];
            }
        }
        this.printHtmlTextToBody = function(html_text) {
            that.is_book_started = true;
            if(that.is_in_table_mode) {
                that.flushPendingTableColumns();
                that.body.printHtmlText("\n</table>\n");
                that.is_in_table_mode = false;
            }
            flushPendingVerseInfo();
            that.body.printHtmlText(html_text);
        }
        this.printItalicsToBody = function(if_normal, if_italic_paragraph) {
            if(that.paragraph_state.isItalic()) {
                that.printHtmlTextToBody(if_italic_paragraph);
            }
            else {
                that.printHtmlTextToBody(if_normal);
            }
        }
        this.printHtmlTextToFooter = function(html_text) {
            that.footer.printHtmlText(html_text);
        }
        this.printHtmlText = function(html_text) {
            if(that.is_in_footer_mode) {
                that.printHtmlTextToBody(html_text);  //YIL added text for popup window
                that.printHtmlTextToFooter(html_text);
            }
            else {
                that.printHtmlTextToBody(html_text);
            }
        }
        this.switchListLevel = function(new_list_level) {
            that.printHtmlTextToBody(
                that.paragraph_state
                    .switchListLevel(new_list_level)
            );
        }
        //1-14-15 added popup window for footnote
        this.newFooterEntry = function() {
            that.is_in_footer_mode = true;
            anchor_label            = newAnchorLabel();
            that.printHtmlTextToBody(
                '<span class="popup_marker"><span class="usfm-f1">' +
                '[<a name="' + anchor_label + '*" href="' + anchor_label + '">' + anchor_label + '</a>]' +
                '</span><span class="popup">'
            );
            /** @noinspection HtmlUnknownAnchorTarget */
            that.printHtmlTextToFooter(
                '<p class="usfm-footer"><span class="usfm-f2">' +
                '[<a name="' + anchor_label + '" href="#' + anchor_label + '*">' + anchor_label + '</a>]' +
                '</span>'
            );
        }
        //yil that function originally generates letter footnote labels.
        //It's changed to number so that international users can have an easier time to read it.
        //private
        function newAnchorLabel() {
            count        = ++that.anchor_count;
            anchor_label = strval((count + 1)); //generating footnote number starting at 1 instead of 0
            /* yil original letter generating label code
            anchor_label = '';
            do {
              anchor_label = chr(ord('a') + (count % 26)) + anchor_label;
              count = (int) floor(count / 26);
            } while (count > 0);*/
            return anchor_label;
        }
        this.closeFooterEntry = function() {
            //end popup
            that.printHtmlTextToBody("</span></span>"); //added popup window end tags
            that.is_in_footer_mode = false;
            that.printHtmlTextToFooter("</p>");
        }
        this.getAndClearHtmlText = function() {
            that.printHtmlTextToBody('');
            /*
            return "<link rel='stylesheet' href='lib".DIRECTORY_SEPARATOR."plugins".DIRECTORY_SEPARATOR.
                                              "usfmtag".DIRECTORY_SEPARATOR."style.css'".
                 " type='text/css'>".
                 that.body.getAndClearHtmlText().
             that.paragraph_state
                  .printTitle(True, 4, False, "").
             that.footer.getAndClearHtmlText();*/
            return that.body.getAndClearHtmlText() +
            that.paragraph_state
                .printTitle(true, 4, false, "") +
            that.footer.getAndClearHtmlText();
        }
        //YIL added that function to corrent indent bug
        this.loseParagraph = function() {
            that.body.printHtmlText(
                that.paragraph_state
                    .closeParagraph()
            );
        }
    }
})();