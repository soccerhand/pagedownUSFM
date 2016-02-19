"use strict";
var UsfmTagDecoder;

if (typeof exports === "object" && typeof require === "function") // we're in a CommonJS (e.g. Node.js) module
    UsfmTagDecoder = exports;
else
    UsfmTagDecoder = {};

/**
 * original code by:
 * Copyright (c) 2011 Rusmin Soetjipt
 * Ported to Dokuwiki by Yvonne Lu 2013
 *
 * 10/6/14 Yvonne Lu
 * Correct indent problem in poetry
 *
 * 8/13/14 Yvonne Lu
 * Implemented /ip as paragraph
 * Implemented /is and /imt as section headings
 *
 * 8/6/14 Yvonne Lu
 * translate \s5 to <hr>
 *
 * Fixed space before punctuation problem for add tags
 *
 * 7/25/14
 * Disabled formatting for \add tags <jesse@distantshores.org>
 *
 *
 * 6/28/14
 * Corrected a bug concerning command parsing.  Punctuation was parsed with the
 * command which caused invalid rendering behavior.  I've noticed that many of the
 * php string functions utilized in the original code are single byte functions.
 * This may cause a problem when the string is in unicode that requires double
 * byte operation. Also, preg_match and ereg_match both hangs my version of
 * dokuwiki.  As a result, I was not able to use these functions.
 *
 *
 * 1/30/14
 * ported function renderOther, renderTable, renderIntroduction to support command
 * 'i', 'it', 'd', 'r', 't', 'tl','x'
 *
 *
 * There seems to be a bug in function renderChapterOrVerse for setting
 * alternate verse number and chapter.  It was using an uninitialized variable,
 * verse number.  I commented out the action for now.
 *
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

(function()  {
    let php = require('phpjs');
    let UsfmText = require('./UsfmText.js');

    const BASE_LEVEL = 0;
    const IS_ITALIC = 1;
    const ALIGNMENT = 2;
    const PARAGRAPH_CLASS = 3;

    const IF_NORMAL = 0;
    const IF_ITALIC_PARAGRAPH = 1;

    const BEFORE_REMAINING = 0;
    const AFTER_REMAINING = 1;

    const MAX_SELAH_CROSS_REFERENCES_LENGTH = 10;

    UsfmTagDecoder.Decoder = function () {

        this.is_selah_cross_reference = false;
        this.paragraph_settings = {
            // Chapter and Verses
            "cd"  : [0, true, 'left', 'usfm-desc'],
            // Titles, Headings, and Label
            "d"   : [0, true, 'left', 'usfm-desc'],
            "sp"  : [0, true, 'left', 'usfm-flush'],
            // Paragraph and Poetry (w/o level parameter]
            "cls" : [0, false, 'right', 'usfm-right'],
            "m"   : [0, false, 'justify', 'usfm-flush'],
            "mi"  : [1, false, 'justify', 'usfm-flush'],
            "p"   : [0, false, 'justify', 'usfm-indent'],
            "pc"  : [0, false, 'center', 'usfm-center'],
            "pm"  : [1, false, 'justify', 'usfm-indent'],
            "pmc" : [1, false, 'justify', 'usfm-flush'],
            "pmo" : [1, false, 'justify', 'usfm-flush'],
            "pmr" : [1, false, 'right', 'usfm-right'],
            "pr"  : [0, false, 'right', 'usfm-right'],
            "qa"  : [1, true, 'center', 'usfm-center'],
            "qc"  : [1, false, 'center', 'usfm-center'],
            "qr"  : [1, true, 'right', 'usfm-right'],
            // Paragraph and Poetry (w/ level parameter]
            "ph"  : [0, false, 'justify', 'usfm-hanging'],
            "pi"  : [1, false, 'justify', 'usfm-indent'],
            "q"   : [2, false, 'left', 'usfm-hanging'],
            "qm"  : [1, true, 'left', 'usfm-hanging'],
            "ip"  : [0, false, 'justify', 'usfm-indent']
        };
        this.title_settings = {
            // Titles, Headings, and Label (w/o level parameter)
            "mr"  : [2, true],
            "r"   : [5, true],
            "sr"  : [5, true],
            // Titles, Headings, and Label (w/ level parameter)
            "imt" : [1, false],
            "is"  : [1, false],
            "mt"  : [1, false],
            "mte" : [1, false],
            "ms"  : [2, false],
            "s"   : [3, false],
        };
        this.substitution_table = {
            // Titles, Headings, and Labels
            "rq"    : ["\n<span class='usfm-selah'><i class='usfm'>"],
            "rq*"   : ["</i></span>\n"],
            // Paragraphs and Poetry
            "b"     : ["\n<br>"],
            "qac"   : ["<span style='font-size: larger;'  class='usfm-qac'>"],
            "qac*"  : ["</span>"],
            "qs"    : ["\n<span class='usfm-selah'><i class='usfm'>"],
            "qs*"   : ["</i></span>\n"],
            // Cross Reference
            "x"     : ["\n<span class='usfm-selah'>"],
            "x*"    : ["</span>\n"],
            // Other
            // 7-25-14 disabled formatting for \add tags <jesse@distantshores.org>
            //"add"  : array ("<i class='usfm'>[", "</i>["],
            //"add*" : array ("]</i>", "]<i class='usfm'>"],
            "add"   : [" "],
            "add*"  : [""],
            "bk"    : ["<i class='usfm'>&quot;", "</i>&quot;"],
            "bk*"   : ["&quot;</i>", "&quot;<i class='usfm'>"],
            "dc"    : ["<code class='usfm'>"],
            "dc*"   : ["</code>"],
            "k"     : ["<code class='usfm'>"],
            "k*"    : ["</code>"],
            "lit"   : ["\n<span class='usfm-selah'><b class='usfm'>"],
            "lit*"  : ["</b></span>\n"],
            "ord"   : ["<sup class='usfm'>"],
            "ord*"  : ["</sup>"],
            "pn*"   : [""],
            "qt"    : ["<i class='usfm'>", "</i>"],
            "qt*"   : ["</i>", "<i class='usfm'>"],
            "s5"    : ["<hr>"], //Yvonne added 8/6/14
            "sig"   : ["<i class='usfm'>", "</i>"],
            "sig*"  : ["</i>", "<i class='usfm'>"],
            "sls"   : ["<i class='usfm'>", "</i>"],
            "sls*"  : ["</i>", "<i class='usfm'>"],
            "tl"    : ["<i class='usfm'>", "</i>"],
            "tl*"   : ["</i>", "<i class='usfm'>"],
            "wj"    : ["<font color='red'"],
            "wj*"   : ["</font>"],
            "em"    : ["<i class='usfm'>", "</i>"],
            "em*"   : ["</i>", "<i class='usfm'>"],
            "bd"    : ["<b class='usfm'>"],
            "bd*"   : ["</b>"],
            "it"    : ["<i class='usfm'>", "</i>"],
            "it*"   : ["</i>", "<i class='usfm'>"],
            "bdit"  : ["<i class='usfm'><b class='usfm'>", "</i></b>"],
            "bdit*" : ["</b></i>", "<b class='usfm'><i class='usfm'>"],
            "no"    : ["", "</i>"],
            "no*"   : ["", "<i class='usfm'>"],
            "sc"    : ["<small class='usfm'>"],
            "sc*"   : ["</small>"],
            "\\"    : ["<br>"],
            "skip"  : ["</usfm> <br>~~NO_STYLING~~"],
            "skip*" : ["<br>~~NO_STYLING~~ <br><usfm>"]
        };
        this.footnote_substitution_table = {
            // Footnotes
            "fdc"  : ["<i class='usfm'>", ""],
            "fdc*" : ["</i>", ""],
            "fl"   : ["<span style='text-decoration: underline;' class='usfm'>", "</span>"],
            "fm"   : ["<code class='usfm'>", ""],
            "fm*"  : ["</code>", ""],
            "fp"   : ["</p>\n<p class='usfm-footer'>", ""],
            "fq"   : ["<i class='usfm'>", "</i>"],
            "fqa"  : ["<i class='usfm'>", "</i>"],
            "fr"   : ["<b class='usfm'>", "</b>"],
            "fv"   : [" <span class='usfm-v'>", "</span>"],
            // Cross References
            "xdc"  : ["<b class='usfm'>", ""],
            "xdc*" : ["</b>", ""],
            "xnt"  : ["<b class='usfm'>", ""],
            "xnt*" : ["</b>", ""],
            "xot"  : ["<b class='usfm'>", ""],
            "xot*" : ["</b>", ""],
            "xo"   : ["<b class='usfm'>", "</b>"],
            "xq"   : ["<i class='usfm'>", "</i>"]
        };
        this.is_poetry = false; //yil added this to solve indent problem


        //yil no parser for now until I find out what it does
        this.usfm_text = new UsfmText.Text();
        //that.usfm_text = new UsfmText(parser);

        let that = this;

        this.decode = function(raw_text) {
            //wfDebug("Internal encoding: ".mb_internal_encoding());
            //wfDebug("UTF-8 compatible: ".mb_check_encoding(raw_text, "UTF-8"));
            //wfDebug("ISO-8859-1 compatible: ".mb_check_encoding(raw_text, "ISO-8859-1"));
            let command   = { value : '' },
                level     = { value : '' },
                remaining = { value : '' };
            let raw_command;
            let usfm_segments = php.explode("\\", raw_text);
            for(let i = 0; i < php.sizeof(usfm_segments); i++) {
                remaining.value = php.strpbrk(usfm_segments[i], " \n");
                /*yil debug
                that.usfm_text.printHtmlText("<br/>remaining: ");
                that.usfm_text.printHtmlText(remaining.value);
                that.usfm_text.printHtmlText("<br/>");*/
                if(remaining.value === false) {
                    raw_command = usfm_segments[i];
                    remaining.value   = '';
                }
                else {
                    raw_command = php.substr(
                        usfm_segments[i], 0,
                        php.strlen(usfm_segments[i]) -
                        php.strlen(remaining.value)
                    );
                    remaining.value   = php.trim(remaining.value, " \n\t\r\0");
                    if(php./*mb_*/substr(remaining.value, php./*mb_*/strlen(remaining.value) - 1, 1) != "\xA0") {
                        remaining.value += " ";
                    }
                }
                if(raw_command == '') {
                    continue;
                }
                else {
                    //yil fix punctuation appended to command token
                    //note:  preg_match and ereg_match hangs my version of dokuwiki for some
                    //reason so I'm not using it here
                    let pos    = php./*mb_*/strpos(raw_command, '*');
                    let cmdlen = php./*mb_*/strlen(raw_command);
                    if(pos) {
                        /* yil debug
                        that.usfm_text.printHtmlText("<br/>pos=: ".  strval(pos));
                        that.usfm_text.printHtmlText("<br/>length=: ".  strval(mb_strlen(raw_command)));*/
                        if((pos + 1) < cmdlen) {
                            //that.usfm_text.printHtmlText("<br/>raw_command=: ".raw_command);
                            let leftover = php./*mb_*/substr(raw_command, pos + 1, cmdlen);
                            //that.usfm_text.printHtmlText("<br/>leftover=: ".  leftover);
                            remaining.value = leftover + ' ' + remaining.value;
                            //that.usfm_text.printHtmlText("<br/>remaining=: ".  remaining.value);
                            raw_command = php./*mb_*/substr(raw_command, 0, pos + 1);
                            //that.usfm_text.printHtmlText("<br/>raw_command=: ".raw_command);
                        }
                    }
                }
                /*yil debug
                that.usfm_text.printHtmlText("<br/>raw_command: ");
                that.usfm_text.printHtmlText(raw_command);
                that.usfm_text.printHtmlText("<br/>");*/
                //filter out number digits from raw command
                let main_command_length = php.strcspn(raw_command, '0123456789');
                command.value             = php.substr(raw_command, 0, main_command_length);
                if(php.strlen(raw_command) > main_command_length) {
                    level.value = php.strval(php.substr(raw_command, main_command_length));
                }
                else {
                    level.value = 1;
                }
                /*yil debug
                that.usfm_text.printHtmlText("<br/>command: ");
                that.usfm_text.printHtmlText(command.value);
                that.usfm_text.printHtmlText("<br/>");*/
                //port it case by case basis
                if((command.value == 'h') || (php.substr(command.value, 0, 2) == 'id') ||
                    (command.value == 'rem') || (command.value == 'sts') ||
                    (php.substr(command.value, 0, 3) == 'toc')
                ) {
                    renderIdentification(command, level, remaining);
                }
                else if(command.value == 'ip') {
                    renderParagraph(command, level, remaining);
                }
                else if((command.value == 'is') || (command.value == 'imt')) {
                    renderTitleOrHeadingOrLabel(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 'i') &&
                    (php.substr(command.value, 0, 2) != 'it')
                ) {
                    renderIntroduction(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 'm') &&
                    (command.value != 'm') && (command.value != 'mi')
                ) {
                    renderTitleOrHeadingOrLabel(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 's') &&
                    (php.substr(command.value, 0, 2) != 'sc') &&
                    (php.substr(command.value, 0, 3) != 'sig') &&
                    (php.substr(command.value, 0, 3) != 'sls')
                ) {
                    if(level.value == 5) {
                        //Yvonne substitue s5 with <hr>
                        command.value += level.value;
                        level.value = 1;
                        renderGeneralCommand(command, level, remaining);
                    }
                    else {
                        renderTitleOrHeadingOrLabel(command, level, remaining);
                    }
                }
                else if((command.value == 'd') || (php.substr(command.value, 0, 1) == 'r')) {
                    renderTitleOrHeadingOrLabel(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 'c') ||
                    (php.substr(command.value, 0, 1) == 'v')
                ) {
                    renderChapterOrVerse(
                        raw_command, command,
                        level, remaining
                    );
                }
                else if((php.substr(command.value, 0, 1) == 'q') &&
                    (php.substr(command.value, 0, 2) != 'qt')
                ) {
                    renderPoetry(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 'p') && (command.value != 'pb') &&
                    (php.substr(command.value, 0, 2) != 'pn') &&
                    (php.substr(command.value, 0, 3) != 'pro')
                ) {
                    renderParagraph(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 't') &&
                    (php.substr(command.value, 0, 2) != 'tl')
                ) {
                    renderTable(command, level);
                }
                else if((command.value == 'b') || (command.value == 'cls') ||
                    (php.substr(command.value, 0, 2) == 'li') ||
                    (command.value == 'm') || (command.value == 'mi') ||
                    (command.value == 'nb')
                ) {
                    renderParagraph(command, level, remaining);
                }
                else if((php.substr(command.value, 0, 1) == 'f') &&
                    (php.substr(command.value, 0, 3) != 'fig')
                ) {
                    renderFootnoteOrCrossReference({ value: raw_command }, remaining);
                    // located in UsfmTag.3.php
                }
                else if(php.substr(command.value, 0, 1) == 'x') {
                    renderFootnoteOrCrossReference({ value: raw_command }, remaining);
                    // located in UsfmTag.3.php
                }
                else {
                    renderOther(raw_command, remaining);
                } // if
            }//for
            return that.usfm_text.getAndClearHtmlText();
        }


        function renderIdentification(command, level, remaining) {
            displayUnsupportedCommand(command, level, remaining);
        }
        function renderIntroduction(command, level, remaining) {
            displayUnsupportedCommand(command, level, remaining);
        }
        function renderTitleOrHeadingOrLabel(command, level, remaining) {
            renderGeneralCommand(command, level, remaining);
        }
        function renderChapterOrVerse(raw_command, command, level, remaining) {
            remaining.value = php.trim(remaining.value, " ");
            if((php.substr(command.value, 0, 1) == 'v') &&
                (php.strlen(raw_command) == php.strlen(command.value))
            ) {
                level.value = extractSubCommand(remaining);
            }
            switch(command.value) {
                case 'c':
                    that.usfm_text.setChapterNumber(remaining.value);
                    break;
                case 'ca':
                    that.usfm_text.setAlternateChapterNumber(remaining.value);
                    break;
                case 'cl':
                    // 10 NOV 2015, Phil Hopper, Issue #368: This is not currently needed on door43.org
                    //that.usfm_text.setChapterLabel(remaining.value);
                    break;
                case 'cp':
                    that.usfm_text.setPublishedChapterNumber(remaining.value);
                    break;
                case 'cd':
                    switchParagraph(command, level);
                    that.usfm_text.printHtmlText(remaining.value);
                    break;
                case 'v':
                    that.usfm_text.setVerseNumber(level.value);
                    that.usfm_text.printHtmlText(remaining.value);
                    break;
                case 'va':
                    //yil verse_number is not initialized
                    //that.usfm_text.setAlternateVerseNumber(verse_number);
                    break;
                case 'vp':
                    //yil verse_number is not initialized
                    //that.usfm_text.setPublishedChapterNumber(verse_number);
                    break;
                default:
                    that.usfm_text.printHtmlText(remaining.value);
            }
        }

        //protected
        function renderPoetry(command, level, remaining) {
            that.is_poetry = true;
            renderGeneralCommand(command, level, remaining);
        }
        //yil added case for 'b' to close out paragraph
        function renderParagraph(command, level, remaining) {
            switch(command.value) {
                case 'nb':
                    that.usfm_text.flushPendingDropCapNumeral(true);
                    that.usfm_text.printHtmlText(remaining.value);
                    break;
                case 'li':
                    that.usfm_text.switchListLevel(level.value);
                    that.usfm_text.printHtmlText("<li class='usfm'>" + remaining.value);
                    break;
                case 'b':
                    renderGeneralCommand(command, level, remaining);
                    if(that.is_poetry) {
                        switchParagraph('m', 1);
                        that.is_poetry = false;
                    }
                    break;
                default:
                    renderGeneralCommand(command, level, remaining);
            }
        }
        function renderTable(command, level, remaining) {
            switch(command.value) {
                case 'tr':
                    that.usfm_text.flushPendingTableColumns();
                    break;
                case 'th':
                    that.usfm_text.insertTableColumn(true, false, remaining.value);
                    break;
                case 'thr':
                    that.usfm_text.insertTableColumn(true, true, remaining.value);
                    break;
                case 'tc':
                    that.usfm_text.insertTableColumn(false, false, remaining.value);
                    break;
                case 'tcr':
                    that.usfm_text.insertTableColumn(false, true, remaining.value);
            }
        }
        function renderFootnoteOrCrossReference(command, remaining) {
            switch(command.value) {
                case 'x':
                case 'f':
                case 'fe':
                    if(php.substr(remaining.value, 1, 1) == ' ') {
                        extractSubCommand(remaining);
                    }
                    if((php./*mb_*/strlen(remaining.value) <= MAX_SELAH_CROSS_REFERENCES_LENGTH)
                        && (php.strpos(remaining.value, ' ') !== false) && (command.value = 'x')
                    ) {
                        this.is_selah_cross_reference = true;
                        renderGeneralCommand(command, 1, remaining);
                    }
                    else {
                        this.is_selah_cross_reference = false;
                        that.usfm_text.newFooterEntry();
                        //that.usfm_text.printHtmlTextToFooter(remaining.value);
                        that.usfm_text.printHtmlText(remaining.value);
                    }
                    break;
                case 'x*':
                case 'f*':
                case 'fe*':
                    if(this.is_selah_cross_reference) {
                        renderGeneralCommand(command, 1, remaining);
                    }
                    else {
                        that.usfm_text.closeFooterEntry();
                        that.usfm_text.printHtmlText(remaining.value);
                    }
                    break;
                case 'fk':
                case 'xk':
                    //that.usfm_text
                    //     .printHtmlTextToFooter(netscapeCapitalize(remaining.value));
                    that.usfm_text
                        .printHtmlText(netscapeCapitalize(remaining.value));
                    break;
                default:
                    if(array_key_exists(
                        command.value,
                        this.footnote_substitution_table
                    )) {
                        setting   = this.footnote_substitution_table[command.value];
                        remaining.value = setting[BEFORE_REMAINING] + remaining.value .
                            setting[AFTER_REMAINING];
                    }
                    //that.usfm_text.printHtmlTextToFooter(remaining.value);
                    that.usfm_text.printHtmlText(remaining.value);
            }
        }
        function renderOther(raw_command, remaining) {
            switch(raw_command) {
                case 'nd':
                    that.usfm_text.printHtmlText(netscapeCapitalize(remaining));
                    break;
                case 'add': //Yvonne processing add and add* tag here to fix space before punctuation problem
                    renderGeneralCommand({ value : raw_command }, 1, trim(remaining)); //get rid of space at the end
                    break;
                case 'add*': //do not add space if remaining start with punctuation
                    if(php.ctype_punct(php.substr(remaining, 0, 1))) {
                        that.usfm_text.printHtmlText(remaining);
                    }
                    else {
                        that.usfm_text.printHtmlText(" " + remaining);
                    }
                    break;
                default:
                    renderGeneralCommand({ value : raw_command }, 1, remaining);
            }
        }
        function displayUnsupportedCommand(command, level, remaining) {
            if(level.value > 1) {
                command.value = command.value + level.value;
            }
            //yil debug
            //that.usfm_text
            //        .printHtmlText(" USFMTag alert: Encountered unsupported command:".command.value.' '.remaining.value."\n");
            that.usfm_text
                .printHtmlText("<!-- usfm:\\" + command.value + ' ' + remaining.value + " -.\n");
        }
        function renderGeneralCommand(command, level, remaining) {
            if(php.array_key_exists(command.value, that.substitution_table)) {
                let html_command = that.substitution_table[command.value];
                if(php.sizeof(html_command) > 1) {
                    that.usfm_text
                        .printItalicsToBody(
                            html_command[IF_NORMAL],
                            html_command[IF_ITALIC_PARAGRAPH]
                        );
                }
                else {
                    that.usfm_text.printHtmlText(html_command[IF_NORMAL]);
                }
                that.usfm_text.printHtmlText(remaining.value);
            }
            else if(php.array_key_exists(command.value, that.paragraph_settings)) {
                switchParagraph(command, level);
                that.usfm_text.printHtmlText(remaining.value);
            }
            else if(php.array_key_exists(command.value, that.title_settings)) {
                printTitle(command, level, remaining.value);
            }
            else {
                displayUnsupportedCommand(command, level, remaining);
            }
        }

        //private
        function extractSubCommand(remaining) {
            let second_whitespace = php.strpos(remaining.value, ' ');
            if(second_whitespace === false) {
                second_whitespace = php.strlen(remaining.value);
            }
            let result    = php.substr(remaining.value, 0, second_whitespace);
            remaining.value = php.substr(remaining.value, second_whitespace + 1);
            return result;
        }
        function switchParagraph(command, level) {
            let setting = that.paragraph_settings[command.value];
            that.usfm_text
                .switchParagraph(
                    level.value + setting[BASE_LEVEL] - 1,
                    setting[IS_ITALIC],
                    setting[ALIGNMENT],
                    setting[PARAGRAPH_CLASS]
                );
        }
        function printTitle(command, level, content) {
            let setting = that.title_settings[command.value];
            that.usfm_text
                .printTitle(
                    level.value + setting[BASE_LEVEL] - 1,
                    setting[IS_ITALIC], content
                );
        }
    }

    function netscapeCapitalize(raw_text) {
        // Uppercase all letters, but make the first letter of every word bigger than
        // the rest, i.e. style of headings in the original Netscape Navigator website
        let words = php.explode(' ', php.strtoupper(raw_text));
        //wfDebug(sizeof(words));
        for(let i = 0; i < php.sizeof(words); i++) {
            if(php./*mb_*/strlen(words[i]) > 1) {
                words[i] = php./*mb_*/substr(words[i], 0, 1) + "<small>" .
                    php./*mb_*/substr(words[i], 1) + "</small>";
            }
            //wfDebug(words[i]);
        }
        return php.implode(' ', words);
    }
})();