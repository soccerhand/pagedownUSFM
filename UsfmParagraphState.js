"use strict";
var UsfmParagraphState;

if (typeof exports === "object" && typeof require === "function") // we're in a CommonJS (e.g. Node.js) module
    UsfmParagraphState = exports;
else
    UsfmParagraphState = {};


/**
 * Copyright (c) 2011 Rusmin Soetjipto
 * ported to Dokuwiki by Yvonne Lu
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
(function() {

  UsfmParagraphState.ParagraphState = function() {

    this.list_level = 0;
    this.indent_level = 0;  // 0 for normal (level-1) paragraph
                                // 1 for level-1 poetry & indented
                                //   paragraph
    this.is_italic = false;
    this.paragraph_class = '';
    this.is_open = false;

    let that = this;

    this.switchListLevel = function(new_list_level) {
      let result = '';
      for (let r = new_list_level; r < that.list_level; r++) {
        result += "\n</ul>";
      }
      for (let r = that.list_level; r < new_list_level; r++) {
        result += "\n<ul class='usfm'>";
      }
      that.list_level = new_list_level;
      return result;
    }


    this.closeParagraph = function() {
      let result = '';
      if (that.is_open) {
        result += that.switchListLevel(0);
        if (that.is_italic) {
          result += '</i>';
          that.is_italic = false;
        }
        result += "</p>\n";
        that.is_open = false;
        return result;
      } else {
        return '';
      }
    }

    // private
    function switchIndentLevel(new_indent_level) {
      let result = that.closeParagraph();

      for (let r = new_indent_level; r < that.indent_level; r++) {
        result += "</blockquote>\n";
      }
      for (let r = that.indent_level; r < new_indent_level; r++) {
        result += "<blockquote class='usfm'>\n";
      }
      that.indent_level = new_indent_level;
      return result;
    }


    this.switchParagraph = function(new_indent_level, is_italic, alignment, paragraph_class)
    {
      let result = switchIndentLevel(new_indent_level);
      result += "<p class='" + paragraph_class + "' align='" + alignment + "'>";
      if (is_italic) {
        that.is_italic = true;
        result += '<i>';
      }
      that.paragraph_class = paragraph_class;
      that.is_open = true;
      return result;
    }

    this.printTitle = function(is_horizontal_line, level, is_italic, content) {
      let result = switchIndentLevel(0);
      if (is_horizontal_line) {
        result += "<hr>";
      }
      if (level > 6) {
        level = 6;
      }
      if (is_italic) {
        result += "<h" + level + " class='usfm'><i>" + content + "</i></h" + level + ">";
      } else {
        result += "<h" + level + " class='usfm'>" + content + "</h" + level + ">";
      }
      return result;
    }

    //111
    this.isItalic = function() {
      return that.is_italic;
    }

    //115
    this.isOpen = function() {
      return that.is_open;
    }

    //119
    this.getParagraphClass = function() {
      return that.paragraph_class;
    }
  }
})();