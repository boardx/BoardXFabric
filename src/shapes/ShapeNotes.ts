// @ts-nocheck
import { getDocument } from '../env';
import { TClassProperties } from '../typedefs';
import { Textbox } from './Textbox';
import { classRegistry } from '../ClassRegistry';
import { createRectNotesDefaultControls } from '../controls/commonControls';
// @TODO: Many things here are configuration related and shouldn't be on the class nor prototype
// regexes, list of properties that are not suppose to change by instances, magic consts.
// this will be a separated effort
export const shapeNotesDefaultValues: Partial<TClassProperties<ShapeNotes>> = {
  minWidth: 20,
  dynamicMinWidth: 2,
  lockScalingFlip: true,
  noScaleCache: false,
  _wordJoiners: /[ \t\r]/,
  splitByGrapheme: true,
  obj_type: 'WBShapeNotes',
  height: 138,
  maxHeight: 138,
  textAlign: 'center',
  uniformScaling: false,
  centeredScaling: false,
};

/**
 * Textbox class, based on IText, allows the user to resize the text rectangle
 * and wraps lines automatically. Textboxes have their Y scaling locked, the
 * user can only change width. Height is adjusted automatically based on the
 * wrapping of lines.
 */
export class ShapeNotes extends Textbox {
  /**selectable
   * Minimum width of textbox, in pixels.
   * @type Number
   * @default
   */
  declare minWidth: number;

  /* boardx cusotm function */
  declare _id: string;

  declare obj_type: string;

  declare locked: boolean;

  declare whiteboardId: string;

  declare userId: string;

  declare timestamp: Date;

  declare verticalAlign: string;

  declare zIndex: number;

  declare lines: object[];

  declare relationship: object[];

  declare icon: string;

  public extendPropeties = [
    'obj_type',
    'whiteboardId',
    'userId',
    'timestamp',
    'zIndex',
    'locked',
    'verticalAlign',
    'lines',
    '_id',
    'zIndex',
    'relationship',
    'icon',
  ];
  /**
   * Minimum calculated width of a textbox, in pixels.
   * fixed to 2 so that an empty textbox cannot go to 0
   * and is still selectable without text.
   * @type Number
   * @default
   */
  declare dynamicMinWidth: number;

  /**
   * Use this boolean property in order to split strings that have no white space concept.
   * this is a cheap way to help with chinese/japanese
   * @type Boolean
   * @since 2.6.0
   */
  declare splitByGrapheme: boolean;

  static textLayoutProperties = [...Textbox.textLayoutProperties, 'width'];

  static ownDefaults: Record<string, any> = shapeNotesDefaultValues;

  static getDefaults() {
    return {
      ...super.getDefaults(),
      controls: createRectNotesDefaultControls(),
      ...ShapeNotes.ownDefaults,
    };
  }

  /**
   * Unlike superclass's version of this function, Textbox does not update
   * its width.
   * @private
   * @override
   */
  initDimensions() {
    if (this.__skipDimension) {
      return;
    }

    this.clearContextTop();
    this._clearCache();

    const newLines = this._splitText();

    if (this.isEditing) {
      this.initDelayedCursor();

      const preHeight = this.height;
      const total = this._getTotalLineHeights() + this.getTopOffset();
      this.height = Math.max(this.maxHeight, total);
      const yOffset = this.height - preHeight;
      this.top += yOffset / 2;
    } else if (this._textLines && this._textLines.length > 0) {
      if (this.height === this.maxHeight) {
        /**
         * scaling
         * total height of _textLines < maxHeight
         */
        let lineHeights = 0;
        const tmp = [];
        for (let i = 0, len = this._textLines.length; i < len; i++) {
          const heightOfLine = this.getHeightOfLine(i);
          lineHeights += heightOfLine;
          if (lineHeights <= this.height - this.getTopOffset()) {
            tmp.push(this._textLines[i]);
          }
        }
        if (tmp.length > 0) {
          const preLines = this._textLines.length;
          this._textLines = tmp;
          if (tmp.length !== preLines) {
            // need add ellipsis at last line
            const lastIndex = this._textLines.length - 1,
              lastLine = this._textLines[lastIndex];
            lastLine.pop();
            lastLine.pop();
            lastLine.pop();
            lastLine.push('.');
            lastLine.push('.');
            lastLine.push('.');
          }
        }
      } else if (this.height > this.maxHeight) {
        /**
         * height > maxHeight
         * exit editing and _textlines total height > maxHeight
         */
        // console.log('### exit editing & initDimensions');
      }
    }

    // clear dynamicMinWidth as it will be different after we re-wrap line
    this.dynamicMinWidth = 0;
    // wrap lines
    this._styleMap = this._generateStyleMap(newLines);
    // if after wrapping, the width is smaller than dynamicMinWidth, change the width and re-wrap
    if (this.dynamicMinWidth > this.width) {
      this._set('width', this.dynamicMinWidth);
    }
    if (this.textAlign.indexOf('justify') !== -1) {
      // once text is measured we need to make space fatter to make justified text.
      this.enlargeSpaces();
    }

    return this.height;
  }
  /**
   * Generate an object that translates the style object so that it is
   * broken up by visual lines (new lines and automatic wrapping).
   * The original text styles object is broken up by actual lines (new lines only),
   * which is only sufficient for Text / IText
   * @private
   */
  _generateStyleMap(textInfo) {
    let realLineCount = 0,
      realLineCharCount = 0,
      charCount = 0;
    const map = {};

    for (let i = 0; i < textInfo.graphemeLines.length; i++) {
      if (textInfo.graphemeText[charCount] === '\n' && i > 0) {
        realLineCharCount = 0;
        charCount++;
        realLineCount++;
      } else if (
        !this.splitByGrapheme &&
        this._reSpaceAndTab.test(textInfo.graphemeText[charCount]) &&
        i > 0
      ) {
        // this case deals with space's that are removed from end of lines when wrapping
        realLineCharCount++;
        charCount++;
      }

      map[i] = { line: realLineCount, offset: realLineCharCount };

      charCount += textInfo.graphemeLines[i].length;
      realLineCharCount += textInfo.graphemeLines[i].length;
    }

    return map;
  }

  /**
   * Returns true if object has a style property or has it on a specified line
   * @param {Number} lineIndex
   * @return {Boolean}
   */
  styleHas(property, lineIndex: number): boolean {
    if (this._styleMap && !this.isWrapping) {
      const map = this._styleMap[lineIndex];
      if (map) {
        lineIndex = map.line;
      }
    }
    return super.styleHas(property, lineIndex);
  }

  /**
   * Returns true if object has no styling or no styling in a line
   * @param {Number} lineIndex , lineIndex is on wrapped lines.
   * @return {Boolean}
   */
  isEmptyStyles(lineIndex: number): boolean {
    if (!this.styles) {
      return true;
    }
    let offset = 0,
      nextLineIndex = lineIndex + 1,
      nextOffset,
      shouldLimit = false;
    const map = this._styleMap[lineIndex],
      mapNextLine = this._styleMap[lineIndex + 1];
    if (map) {
      lineIndex = map.line;
      offset = map.offset;
    }
    if (mapNextLine) {
      nextLineIndex = mapNextLine.line;
      shouldLimit = nextLineIndex === lineIndex;
      nextOffset = mapNextLine.offset;
    }
    const obj =
      typeof lineIndex === 'undefined'
        ? this.styles
        : { line: this.styles[lineIndex] };
    for (const p1 in obj) {
      for (const p2 in obj[p1]) {
        if (p2 >= offset && (!shouldLimit || p2 < nextOffset)) {
          // eslint-disable-next-line no-unused-vars
          for (const p3 in obj[p1][p2]) {
            return false;
          }
        }
      }
    }
    return true;
  }

  /**
   * @param {Number} lineIndex
   * @param {Number} charIndex
   * @private
   */
  _getStyleDeclaration(lineIndex: number, charIndex: number) {
    if (this._styleMap && !this.isWrapping) {
      const map = this._styleMap[lineIndex];
      if (!map) {
        return null;
      }
      lineIndex = map.line;
      charIndex = map.offset + charIndex;
    }
    return super._getStyleDeclaration(lineIndex, charIndex);
  }

  /**
   * @param {Number} lineIndex
   * @param {Number} charIndex
   * @param {Object} style
   * @private
   */
  _setStyleDeclaration(lineIndex: number, charIndex: number, style: object) {
    const map = this._styleMap[lineIndex];
    lineIndex = map.line;
    charIndex = map.offset + charIndex;

    this.styles[lineIndex][charIndex] = style;
  }

  /**
   * @param {Number} lineIndex
   * @param {Number} charIndex
   * @private
   */
  _deleteStyleDeclaration(lineIndex: number, charIndex: number) {
    const map = this._styleMap[lineIndex];
    lineIndex = map.line;
    charIndex = map.offset + charIndex;
    delete this.styles[lineIndex][charIndex];
  }

  /**
   * probably broken need a fix
   * Returns the real style line that correspond to the wrapped lineIndex line
   * Used just to verify if the line does exist or not.
   * @param {Number} lineIndex
   * @returns {Boolean} if the line exists or not
   * @private
   */
  _getLineStyle(lineIndex: number): boolean {
    const map = this._styleMap[lineIndex];
    return !!this.styles[map.line];
  }

  /**
   * Set the line style to an empty object so that is initialized
   * @param {Number} lineIndex
   * @param {Object} style
   * @private
   */
  _setLineStyle(lineIndex: number) {
    const map = this._styleMap[lineIndex];
    this.styles[map.line] = {};
  }

  /**
   * Wraps text using the 'width' property of Textbox. First this function
   * splits text on newlines, so we preserve newlines entered by the user.
   * Then it wraps each line using the width of the Textbox by calling
   * _wrapLine().
   * @param {Array} lines The string array of text that is split into lines
   * @param {Number} desiredWidth width you want to wrap to
   * @returns {Array} Array of lines
   */
  _wrapText(lines: Array<any>, desiredWidth: number): Array<any> {
    const wrapped = [];
    this.isWrapping = true;
    for (let i = 0; i < lines.length; i++) {
      wrapped.push(...this._wrapLine(lines[i], i, desiredWidth));
    }
    this.isWrapping = false;
    return wrapped;
  }

  /**
   * Helper function to measure a string of text, given its lineIndex and charIndex offset
   * It gets called when charBounds are not available yet.
   * Override if necessary
   * Use with {@link Textbox#wordSplit}
   *
   * @param {CanvasRenderingContext2D} ctx
   * @param {String} text
   * @param {number} lineIndex
   * @param {number} charOffset
   * @returns {number}
   */
  _measureWord(word, lineIndex: number, charOffset = 0): number {
    let width = 0,
      prevGrapheme;
    const skipLeft = true;
    for (let i = 0, len = word.length; i < len; i++) {
      const box = this._getGraphemeBox(
        word[i],
        lineIndex,
        i + charOffset,
        prevGrapheme,
        skipLeft
      );
      width += box.kernedWidth;
      prevGrapheme = word[i];
    }
    return width;
  }

  /**
   * Override this method to customize word splitting
   * Use with {@link Textbox#_measureWord}
   * @param {string} value
   * @returns {string[]} array of words
   */
  wordSplit(value: string): string[] {
    return value.split(this._wordJoiners);
  }

  /**
   * Wraps a line of text using the width of the Textbox and a context.
   * @param {Array} line The grapheme array that represent the line
   * @param {Number} lineIndex
   * @param {Number} desiredWidth width you want to wrap the line to
   * @param {Number} reservedSpace space to remove from wrapping for custom functionalities
   * @returns {Array} Array of line(s) into which the given text is wrapped
   * to.
   */
  /** This is the method of char split */
  graphemeSplitForRectNotes(textstring: string): string[] {
    const graphemes = [];
    const words = textstring.split(/\b/);
    for (let i = 0; i < words.length; i++) {
      // 检查单词是否全为拉丁字母，长度不大于16
      if (/^[a-zA-Z]{1,16}$/.test(words[i])) {
        graphemes.push(words[i]);
      } else {
        for (let j = 0; j < words[i].length; j++) {
          graphemes.push(words[i][j]);
        }
      }
    }
    return graphemes;
  }

  _wrapLine(
    _line,
    lineIndex: number,
    desiredWidth: number,
    reservedSpace = 0
  ): Array<any> {
    const additionalSpace = this._getWidthOfCharSpacing(),
      splitByGrapheme = this.splitByGrapheme,
      graphemeLines = [],
      words = splitByGrapheme
        ? this.graphemeSplitForRectNotes(_line)
        : this.wordSplit(_line),
      infix = splitByGrapheme ? '' : ' ';

    let lineWidth = 0,
      line = [],
      // spaces in different languages?
      offset = 0,
      infixWidth = 0,
      largestWordWidth = 0,
      lineJustStarted = true;
    // fix a difference between split and graphemeSplit
    if (words.length === 0) {
      words.push([]);
    }
    desiredWidth -= reservedSpace;
    // measure words
    const data = words.map((word) => {
      // if using splitByGrapheme words are already in graphemes.
      word = splitByGrapheme ? word : this.graphemeSplitForRectNotes(word);
      const width = this._measureWord(word, lineIndex, offset);
      largestWordWidth = Math.max(width, largestWordWidth);
      offset += word.length + 1;
      return { word: word, width: width };
    });
    const maxWidth = Math.max(
      desiredWidth,
      largestWordWidth,
      this.dynamicMinWidth
    );
    // layout words
    offset = 0;
    let i;
    for (i = 0; i < words.length; i++) {
      const word = data[i].word;
      const wordWidth = data[i].width;
      offset += word.length;

      lineWidth += infixWidth + wordWidth - additionalSpace;
      if (lineWidth > maxWidth && !lineJustStarted) {
        graphemeLines.push(line);
        line = [];
        lineWidth = wordWidth;
        lineJustStarted = true;
      } else {
        lineWidth += additionalSpace;
      }

      if (!lineJustStarted && !splitByGrapheme) {
        line.push(infix);
      }
      if (word.length > 1) {
        line = line.concat(word.split(''));
      } else {
        line = line.concat(word);
      }

      infixWidth = splitByGrapheme
        ? 0
        : this._measureWord([infix], lineIndex, offset);
      offset++;
      lineJustStarted = false;
    }

    i && graphemeLines.push(line);

    if (largestWordWidth + reservedSpace > this.dynamicMinWidth) {
      this.dynamicMinWidth = largestWordWidth - additionalSpace + reservedSpace;
    }
    return graphemeLines;
  }

  /**
   * Detect if the text line is ended with an hard break
   * text and itext do not have wrapping, return false
   * @param {Number} lineIndex text to split
   * @return {Boolean}
   */
  isEndOfWrapping(lineIndex: number): boolean {
    if (!this._styleMap[lineIndex + 1]) {
      // is last line, return true;
      return true;
    }
    if (this._styleMap[lineIndex + 1].line !== this._styleMap[lineIndex].line) {
      // this is last line before a line break, return true;
      return true;
    }
    return false;
  }

  /**
   * Detect if a line has a linebreak and so we need to account for it when moving
   * and counting style.
   * @return Number
   */
  missingNewlineOffset(lineIndex) {
    if (this.splitByGrapheme) {
      return this.isEndOfWrapping(lineIndex) ? 1 : 0;
    }
    return 1;
  }

  /**
   * Gets lines of text to render in the Textbox. This function calculates
   * text wrapping on the fly every time it is called.
   * @param {String} text text to split
   * @returns {Array} Array of lines in the Textbox.
   * @override
   */
  textSplitTextIntoLines(text: string) {
    const lines = text.split(this._reNewline),
      newLines = new Array<string[]>(lines.length),
      newLine = ['\n'];
    let newText: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      newLines[i] = this.graphemeSplit(lines[i]);
      newText = newText.concat(newLines[i], newLine);
    }
    newText.pop();
    return {
      _unwrappedLines: newLines,
      lines: lines,
      graphemeText: newText,
      graphemeLines: newLines,
    };
  }
  _splitTextIntoLines(text) {
    const width = this.width - this.getLeftOffset();

    const newText = this.textSplitTextIntoLines(text),
      graphemeLines = this._wrapText(newText.lines, width),
      lines = new Array(graphemeLines.length);
    for (let i = 0; i < graphemeLines.length; i++) {
      lines[i] = graphemeLines[i].join('');
    }
    newText.lines = lines;
    newText.graphemeLines = graphemeLines;
    return newText;
  }

  getMinWidth() {
    return Math.max(this.minWidth, this.dynamicMinWidth);
  }

  _removeExtraneousStyles() {
    const linesToKeep = {};
    for (const prop in this._styleMap) {
      if (this._textLines[prop]) {
        linesToKeep[this._styleMap[prop].line] = 1;
      }
    }
    for (const prop in this.styles) {
      if (!linesToKeep[prop]) {
        delete this.styles[prop];
      }
    }
  }

  getObject() {
    const object = {};
    const keys = [
      '_id',
      'angle',
      'backgroundColor',
      'fill',
      'fontFamily',
      'fontSize',
      'height',
      'width',
      'left',
      'lines', // the arrows array [{…}]
      'lockUniScaling',
      'locked',
      'lockMovementX', // boolean, lock the verticle movement
      'lockMovementY', // boolean, lock the horizontal movement
      'lockScalingFlip', // boolean,  make it can not be inverted by pulling the width to the negative side
      'fontWeight',
      'lineHeight',
      'obj_type',
      'originX',
      'originY',
      'panelObj', // the parent panel string
      'relationship', // relationship with panel for transform  [1.43, 0, 0, 1.43, 7.031931057304291, 16.531768328466796]
      'scaleX',
      'scaleY',
      'selectable',
      'text',
      'textAlign',
      'top',
      'userNo',
      'userId',
      'whiteboardId',
      'zIndex',
      'version',
      'isPanel',
      'editable',
      'path',
      'strokeWidth',
      'strokeUniform', // set up to true then strokewidth doesn't change when scaling
      'stroke', // border color
      'selectable', // boolean, When set to `false`, an object can not be selected for modification (using either point-click-based or group-based selection). But events still fire on it.
      'icon',
      'lineWidth',
      'fixedLineWidth',
      'aCoords',
      'shapeScaleX',
      'shapeScaleY',
      'verticalAlign',
      'maxHeight',
      'shadow',
      'subObjs',
    ];
    keys.forEach((key) => {
      object[key] = this[key];
    });
    return object;
  }

  /**
   * Returns object representation of an instance
   * @method toObject
   * @param {Array} [propertiesToInclude] Any properties that you might want to additionally include in the output
   * @return {Object} object representation of an instance
   */
  toObject(propertiesToInclude: Array<any>): object {
    return super.toObject(
      [...this.extendPropeties, 'minWidth', 'splitByGrapheme'].concat(
        propertiesToInclude
      )
    );
  }
  /**boardx custom function */
  getObjectsIntersected() {
    const objects = this.canvas._getIntersectedObjects(this);
    objects.filter((obj) => {
      return obj._id !== this._id && obj.obj_type !== 'WBArrow';
    });
    return objects;
  }

  setLockedShadow(locked) {
    if (locked) {
      this.shadow = new fabric.Shadow({
        blur: 2,
        offsetX: 0,
        offsetY: 0,
        color: 'rgba(0, 0, 0, 0.5)',
      });
    } else {
      this.shadow = new fabric.Shadow({
        blur: 8,
        offsetX: 0,
        offsetY: 4,
        color: 'rgba(0,0,0,0.04)',
      });
    }
  }

  /* caculate cusor positon in the middle of the textbox */
  getCenteredTop(rectHeight) {
    const textHeight = this.height;
    return (rectHeight - textHeight) / 2;
  }

  _renderBackground(ctx) {
    if (!this.backgroundColor) {
      return;
    }
    const dim = this._getNonTransformedDimensions();
    ctx.fillStyle = this.backgroundColor;

    //ctx.shadowBlur = 20;
    // ctx.shadowOffsetX = 2 * this.scaleX * canvas.getZoom();
    // ctx.shadowOffsetY = 6 * this.scaleY * canvas.getZoom();
    //ctx.shadowColor = 'rgba(0,0,0,0.1)';
    // ctx.shadowColor = 'rgba(0,0,0,1)';

    //ctx.fillRect(-dim.x / 2, -dim.y / 2, dim.x, dim.y);

    // if there is background color no other shadows
    // should be casted
    //this._removeShadow(ctx);
    /*
      0: rect
      1: diamond
      2: rounded rect
      3: circle
      4: hexagon
      5: triangle
      6: parallelogramIcon
      7: star
      8: cross
      9: leftside right triangle
      10: rightside right triangle
      11: topside semicirle circle
      12: top-left quarter circle
      13: Constallation Rect
      14: Constellation Round
    */
    const shapeArray = [
      'M-50,-50L50,-50 50,50 -50,50z', // 0: rect
      'm-50,0 l50,-50 50,50 -50,50 -50,-50z', // 1: diamond
      'M-50,-35 Q-50,-50 -35,-50 L35,-50 Q50,-50 50,-35 L50,35 Q50,50 35,50 L-35,50 Q-50,50 -50,35 Z', // 2: rounded rect
      'M-50,0a50,50 0 1,0 100,0a50,50 0 1,0 -100,0', // 3: circle
      'm -43.476 -25.4636 l 43.476 -24.5364 l 43.7551 25.2641 l 0 50.5157 l -43.7551 24.2202 l -43.7551 -25.2654 l 0 -50.5157 z', // 4: hexagon
      'm-50,50l50,-100l50,100l-100,0z', // 5: triangle
      'm-50,50l20,-100l80,0l-20,100l-80,0z', // 6: parallelogramIcon
      'm-50,-10l38,0l12,-38l12,38l38,0l-30,23l12,38l-30,-24l-30,24l12,-38l-30,-23z', // 7: star
      'm-50,-15l33,0l0,-33l34,0l0,33l33,0l0,34l-33,0l0,33l-34,0l0,-33l-33,0l0,-34z', // 8: cross
      'm50,50l-100,0l0,-100l100,100z', // 9: leftside right triangle
      'm-50,50l100,0l0,-100l-100,100z', // 10: rightside right triangle
      'm50,25l-100,-0.00205c3.5,-27.5 25,-48 50,-48c25,0 46.5,20.5 50,48z', // 11: topside semicirle circle
      'm-50,50c7,-55 47,-96 97,-97l0,65l0,32l-97,-0.00392z', // 12: top-left quarter circle
      'm20,0l25,23l0,24l-100,0l0,-100l100,0l0,23l-25,24l-0.15,0.14l0.15,0.14l-0.00001,0z', // 13: Constallation Rect
      'm20,1c0.002,0.002 0.004,0.004 0.01,0.001c0.007,0.01 0.015,0.02 0.02,0.03l0,0l0.001,0.0004l0.005,0.003l0.04,0.03l0.3,0.2l2.5,2l20,15c-7,15 -23,26 -42,26c-25,0 -45,-20 -45,-45c0,-25 20,-45 45,-45c19,0 35,10 42,25c-11,9 -17,14 -20,16c-1.5,1 -2,1.5 -2.5,2c-0.2,0.15 -0.3,0.2 -0.35,0.3c-0.02,0.02 -0.04,0.04 -0.05,0.06c-0.006,0.01 -0.02,0.03 -0.03,0.06c-0.005,0.015 -0.02,0.04 -0.03,0.07c-0.005,0.015 -0.01,0.04 -0.007,0.07c0.002,0.02 0.007,0.04 0.015,0.06c0.003,0.006 0.006,0.012 0.009,0.018c0.003,0.004 0.006,0.009 0.009,0.014c0.003,0.005 0.009,0.01 0.01,0.015c0.004,0.005 0.01,0.015 0.012,0.017z', // 14: Constellation Round
    ];

    ctx.save();

    const svgPath = new Path2D(shapeArray[this.icon]);
    const m = getDocument()
      .createElementNS('http://www.w3.org/2000/svg', 'svg')
      .createSVGMatrix();
    m.a = this.width / 100;
    m.b = 0;
    m.c = 0;
    m.d = this.height / 100;
    m.e = 0;
    m.f = 0;
    const path = new Path2D();
    path.addPath(svgPath, m);
    // ctx.lineWidth = this.lineWidth / (this.width / 138 + this.height / 138) / 2;
    ctx.lineWidth = this.lineWidth;
    ctx.strokeStyle = this.stroke;
    ctx.stroke(path);
    ctx.fillStyle = this.backgroundColor;
    ctx.fill(path);
    ctx.restore();
  }
  getTopOffset() {
    let tOffset = 0;
    switch (this.icon) {
      case 0:
      case 2:
        tOffset = 40;
        break;
      case 1:
      case 3:
      case 5:
        tOffset = this.height / 2;
        break;
      case 4:
        tOffset = this.height / 3;
        break;
      default:
    }
    return tOffset;
  }
  getLeftOffset() {
    let lOffset = 0;
    switch (this.icon) {
      case 0:
      case 2:
      case 4:
        lOffset = 40;
        break;
      case 1:
      case 3:
      case 5:
        lOffset = this.width / 2;
        break;
      default:
    }
    return lOffset;
  }
  _getTopOffset() {
    switch (this.verticalAlign) {
      case 'middle':
        return -this._getTotalLineHeight() / 2;
      case 'bottom':
        return this.height / 2 - this._getTotalLineHeight();
      default:
        return -this.height / 2;
    }
  }
  _getTotalLineHeight() {
    return this._textLines.reduce(
      (total, _line, index) => total + this.getHeightOfLine(index),
      0
    );
  }

  _renderText(ctx) {
    ctx.shadowOffsetX = ctx.shadowOffsetY = ctx.shadowBlur = 0;
    ctx.shadowColor = '';

    if (this.paintFirst === 'stroke') {
      this._renderTextStroke(ctx);
      this._renderTextFill(ctx);
    } else {
      this._renderTextFill(ctx);
      this._renderTextStroke(ctx);
    }
  }
  calcTextHeight() {
    let lineHeight;
    let height = 0;
    for (let i = 0, len = this._textLines.length; i < len; i++) {
      lineHeight = this.getHeightOfLine(i);
      height += i === len - 1 ? lineHeight / this.lineHeight : lineHeight;
    }

    const desiredHeight = this.height * (100 / 138);

    if (height > desiredHeight) {
      this.set('fontSize', this.fontSize - 2);
      //@ts-ignore
      this._splitTextIntoLines(this.text);
      height = this.maxHeight;
      return Math.max(height, this.height);
    }
    if (
      height < this.maxHeight &&
      this.maxHeight - height > 60 &&
      this.fontSize < 24
    ) {
      this.fontSize += 2;
      //@ts-ignore
      this._splitTextIntoLines(this.text.trim());

      return Math.max(height, this.height);
    }

    this.height = this.maxHeight;
  }
  _renderTextCommon(ctx, method) {
    ctx.save();
    let lineHeights = 0;
    const left = this._getLeftOffset();
    const top = this._getTopOffset();
    const offsets = this._applyPatternGradientTransform(
      ctx,
      method === 'fillText' ? this.fill : this.stroke
    );

    for (let i = 0, len = this._textLines.length; i < len; i++) {
      const heightOfLine = this.getHeightOfLine(i);
      const maxHeight = heightOfLine / this.lineHeight;
      const leftOffset = this._getLineLeftOffset(i);
      this._renderTextLine(
        method,
        ctx,
        this._textLines[i],
        left + leftOffset - offsets.offsetX,
        top + lineHeights + maxHeight - offsets.offsetY,
        i
      );
      lineHeights += heightOfLine;
    }
    ctx.restore();
  }
  renderEmoji(ctx) {
    if (this.emoji === undefined) {
      return;
    }

    let width = 0;
    const imageList = [
      this.canvas.emoji_thumb,
      this.canvas.emoji_love,
      this.canvas.emoji_smile,
      this.canvas.emoji_shock,
      this.canvas.emoji_question,
    ];
    const imageListArray = [];
    const emojiList = [];
    for (let i = 0; i < 5; i++) {
      if (this.emoji[i] !== 0) {
        imageListArray.push(imageList[i]);
        emojiList.push(this.emoji[i]);
        width += 26.6;
      }
    }

    if (emojiList.length === 0) return;

    const x = this.width / 2 - width;
    const y = this.height / 2 - 18;
    ctx.font = '10px Inter ';
    ctx.lineJoin = 'round';
    ctx.save();
    ctx.translate(x - 10, y);
    this.drawRoundRectPath(ctx, width, 15, 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fill();
    ctx.restore();

    //ctx.strokeRect(x - 10, y, width, 16);
    //ctx.fillRect(x - 10 + 10 / 2, y + 10 / 2, width - 10, 16 - 10);
    ctx.fillStyle = '#000';
    const isEmojiThumbExist = !(this.canvas.emoji_thumb === undefined);
    if (isEmojiThumbExist) {
      let modifier = 0;
      for (let i = 0; i < imageListArray.length; i++) {
        const imageX = this.width / 2 - 33.6 + modifier + 2;
        const imageY = this.height / 2 - 15;
        const imageW = 10;
        const imageH = 10;
        ctx.drawImage(imageListArray[i], imageX, imageY, imageW, imageH);
        ctx.fillText(
          emojiList[i].toString(),
          this.width / 2 - 20.6 + modifier + 1,
          y + 12
        );
        modifier -= 23.6;
      }
    }
  }

  _getTotalLineHeights() {
    return this._textLines.reduce(
      (total, _line, index) => total + this.getHeightOfLine(index),
      0
    );
  }

  _getSVGLeftTopOffsets() {
    return {
      textLeft: -this.width / 2,
      textTop: this._getTopOffset(),
      lineTop: this.getHeightOfLine(0),
    };
  }
  getWidgetMenuList() {
    if (this.locked) {
      return ['objectLock'];
    }
    return [
      'more',
      'fontSize',
      'textAlign',
      'changeFont',
      'backgroundColor',
      'fontColor',
      'borderLineIcon',
      'fontWeight',
      'objectLock',
      'shapeBorderColor',
      'lineWidth',
      'borderLineIcon',
      'delete',
      'aiassist',
    ];
  }
  getWidgetMenuLength() {
    if (this.locked) return 50;
    return 420;
  }
  getContextMenuList() {
    let menuList;
    if (this.locked) {
      menuList = [
        'Export board',
        'Exporting selected area',
        'Create Share Back',
        'Bring forward',
        'Bring to front',
        'Send backward',
        'Send to back',
        'Copy as image',
        'Copy As Text',
      ];
    } else {
      menuList = [
        'Export board',
        'Exporting selected area',
        'Create Share Back',
        'Bring forward',
        'Bring to front',
        'Send backward',
        'Send to back',
        'Duplicate',
        'Copy',
        'Copy as image',
        'Copy As Text',
        'Paste',
        'Cut',
        'Edit',
        'Delete',
      ];
    }
    menuList.push('Select All');
    if (this.locked) {
      menuList.push('Unlock');
    } else {
      menuList.push('Lock');
    }
    // const notLockedPanel = this.isPanel && !this.locked;
    // if (notLockedPanel) {
    //   menuList.push('Switch to non-panel');
    // } else {
    //   menuList.push('Switch to panel');
    // }
    return menuList;
  }
}

classRegistry.setClass(ShapeNotes);
