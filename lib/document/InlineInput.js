/*
	Terminal Kit

	Copyright (c) 2009 - 2020 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



const Promise = require( 'seventh' ) ;
const EditableTextBox = require( './EditableTextBox.js' ) ;
const RowMenu = require( './RowMenu.js' ) ;
const string = require( 'string-kit' ) ;
const computeAutoCompleteArray = require( '../autoComplete.js' ) ;



/*
	This is the Document-model version of .inputField().
	Like an EditableTextBox, with a one-line hard-line-wrap TextBuffer, outputHeight start at 1 but can grow when the user
	type a lot of thing, can auto-complete with or without menu, have history, and so on...
*/

function InlineInput( options = {} ) {
	if ( options.value ) { options.content = options.value ; }

	// It is always 1 at the begining
	options.outputHeight = 1 ;

	// No scrolling
	options.scrollable = options.hasVScrollBar = options.hasHScrollBar = options.extraScrolling = false ;
	options.scrollX = options.scrollY = 0 ;

	// It always have line-wrapping on
	options.lineWrap = true ;

	this.onAutoCompleteMenuSubmit = this.onAutoCompleteMenuSubmit.bind( this ) ;
	this.onAutoCompleteMenuCancel = this.onAutoCompleteMenuCancel.bind( this ) ;

	EditableTextBox.call( this , options ) ;

	this.history = options.history ;
	this.contentArray = options.history ? [ ... options.history , this.content ] : [ this.content ] ;
	this.contentIndex = this.contentArray.length - 1 ;
	
	this.disabled = !! options.disabled ;
	this.submitted = !! options.submitted ;
	this.cancelable = !! options.cancelable ;
	this.canceled = !! options.canceled ;

	this.autoComplete = options.autoComplete ;
	this.useAutoCompleteHint = !! ( this.autoComplete && ( options.useAutoCompleteHint || options.autoCompleteHint ) ) ;
	this.useAutoCompleteMenu = !! ( this.autoComplete && ( options.useAutoCompleteMenu || options.autoCompleteMenu ) ) ;
	this.autoCompleteMenu = null ;
	this.autoCompleteLeftPart = null ;
	this.autoCompleteRightPart = null ;

	this.menuOptions = Object.assign( {} , this.defaultMenuOptions , options.menu ) ;
	
	this.placeholder = options.placeholder ;
	this.placeholderHasMarkup = !! options.placeholderHasMarkup ;
	
	if ( this.placeholder ) {
		this.setAltContent( this.placeholder , this.placeholderHasMarkup ) ;
	}
	
	// Only draw if we are not a superclass of the object
	if ( this.elementType === 'InlineInput' && ! options.noDraw ) { this.draw() ; }
}

module.exports = InlineInput ;

InlineInput.prototype = Object.create( EditableTextBox.prototype ) ;
InlineInput.prototype.constructor = InlineInput ;
InlineInput.prototype.elementType = 'InlineInput' ;

// Has a fallback textBuffer for hint/placeholder
InlineInput.prototype.useAltTextBuffer = true ;



InlineInput.prototype.defaultMenuOptions = {
	buttonBlurAttr: { bgColor: 'default' , color: 'default' } ,
	buttonFocusAttr: { bgColor: 'green' , color: 'blue' , dim: true } ,
	buttonDisabledAttr: { bgColor: 'white' , color: 'brightBlack' } ,
	buttonSubmittedAttr: { bgColor: 'brightWhite' , color: 'brightBlack' } ,
	buttonSeparatorAttr: { bgColor: 'default' } ,
	backgroundAttr: { bgColor: 'default' } ,
	//leftPadding: ' ' , rightPadding: ' ' ,
	justify: true ,
	keyBindings: Object.assign( {} , RowMenu.prototype.keyBindings , {
		TAB: 'next' ,
		SHIFT_TAB: 'previous'
	} )
} ;



InlineInput.prototype.destroy = function( isSubDestroy ) {
	EditableTextBox.prototype.destroy.call( this , isSubDestroy ) ;
} ;



InlineInput.prototype.keyBindings = {
	ENTER: 'submit' ,
	KP_ENTER: 'submit' ,
	ESCAPE: 'cancel' ,
	TAB: 'autoComplete' ,
	CTRL_R: 'historyAutoComplete' ,
	UP: 'historyPrevious' ,
	DOWN: 'historyNext' ,
	BACKSPACE: 'backDelete' ,
	DELETE: 'delete' ,
	LEFT: 'backward' ,
	RIGHT: 'forward' ,
	CTRL_LEFT: 'startOfWord' ,
	CTRL_RIGHT: 'endOfWord' ,
	HOME: 'startOfLine' ,
	END: 'endOfLine' ,
	CTRL_O: 'copyClipboard' ,
	CTRL_P: 'pasteClipboard'
} ;



InlineInput.prototype.autoResizeAndDraw = function( onlyDrawCursor = false ) {
	if ( this.textBuffer.buffer.length > this.outputHeight ) {
		this.setSizeAndPosition( { outputHeight: this.textBuffer.buffer.length } ) ;
	}

	if ( ! onlyDrawCursor ) {
		this.draw() ;
	}
	else {
		this.drawCursor() ;
	}
} ;



InlineInput.prototype.autoResizeAndDrawCursor = function() {
	return this.autoResizeAndDraw( true ) ;
} ;



InlineInput.prototype.runAutoCompleteHint = async function( autoComplete ) {
	//console.error( "bob, please")
	var autoCompleted ;

	var [ leftPart , rightPart ] = this.textBuffer.getCursorSplittedText() ;

	if ( Array.isArray( autoComplete ) ) {
		autoCompleted = computeAutoCompleteArray( autoComplete , leftPart , false ) ;
	}
	else if ( typeof autoComplete === 'function' ) {
		autoCompleted = await autoComplete( leftPart , false ) ;
	}
	else {
		return ;
	}

	if ( Array.isArray( autoCompleted ) ) {
		if ( ! autoCompleted.length ) { return ; }
		autoCompleted = autoCompleted[ 0 ] ;
	}

	this.altTextBuffer.setText( autoCompleted + rightPart ) ;
	//this.altTextBuffer.runStateMachine() ;
	this.autoResizeAndDraw() ;
} ;



InlineInput.prototype.runAutoComplete = async function( autoComplete ) {
	var autoCompleted ;

	[ this.autoCompleteLeftPart , this.autoCompleteRightPart ] = this.textBuffer.getCursorSplittedText() ;

	if ( Array.isArray( autoComplete ) ) {
		autoCompleted = computeAutoCompleteArray( autoComplete , this.autoCompleteLeftPart , this.useAutoCompleteMenu ) ;
	}
	else if ( typeof autoComplete === 'function' ) {
		autoCompleted = await autoComplete( this.autoCompleteLeftPart , this.useAutoCompleteMenu ) ;
	}
	else {
		return ;
	}

	if ( Array.isArray( autoCompleted ) ) {
		if ( ! autoCompleted.length ) { return ; }

		if ( this.useAutoCompleteMenu ) {
			this.runAutoCompleteMenu( autoCompleted ) ;
			return ;
		}

		autoCompleted = autoCompleted[ 0 ] ;
	}

	this.runAutoCompleted( autoCompleted ) ;
} ;



InlineInput.prototype.runAutoCompleted = async function( autoCompleted ) {
	this.textBuffer.setText( autoCompleted + this.autoCompleteRightPart ) ;
	this.textBuffer.setCursorOffset( autoCompleted.length ) ;
	this.textBuffer.runStateMachine() ;
	this.autoResizeAndDraw() ;
} ;



InlineInput.prototype.runAutoCompleteMenu = async function( items ) {
	// No items, leave now...
	if ( ! items || ! items.length ) { return ; }

	if ( this.autoCompleteMenu ) {
		// Should never happen, but just in case...
		this.autoCompleteMenu.destroy() ;
	}

	// Make the ColumnMenu a child of the button, so focus cycle will work as expected
	this.autoCompleteMenu = new RowMenu( Object.assign( {} , this.menuOptions , {
		parent: this ,
		x: this.outputX ,
		y: this.outputY + this.outputHeight ,
		outputWidth: this.outputWidth ,
		items: items.map( item => ( { value: item , content: item } ) )
	} ) ) ;

	this.document.giveFocusTo( this.autoCompleteMenu ) ;

	this.autoCompleteMenu.once( 'submit' , this.onAutoCompleteMenuSubmit ) ;
	this.autoCompleteMenu.once( 'cancel' , this.onAutoCompleteMenuCancel ) ;
} ;



InlineInput.prototype.onAutoCompleteMenuSubmit = function( selectedText ) {
	this.autoCompleteMenu.destroy() ;
	this.autoCompleteMenu = null ;
	this.document.giveFocusTo( this ) ;
	this.runAutoCompleted( selectedText ) ;
} ;



InlineInput.prototype.onAutoCompleteMenuCancel = function() {
	this.autoCompleteMenu.destroy() ;
	this.autoCompleteMenu = null ;
	this.document.giveFocusTo( this ) ;
} ;



InlineInput.prototype.onKey = function( key , trash , data ) {
	if ( this.autoCompleteMenu ) {
		// If the autoCompleteMenu is on, force a cancel
		this.autoCompleteMenu.emit( 'cancel' ) ;
	}

	if ( data && data.isCharacter ) {
		if ( this.placeholder ) {
			// Remove the placeholder on the first input
			this.placeholder = null ;
			this.setAltContent( '' , false , true ) ;
		}
		
		this.textBuffer.insert( key , this.textAttr ) ;
		this.textBuffer.runStateMachine() ;
		
		if ( this.useAutoCompleteHint ) {
			this.runAutoCompleteHint( this.autoComplete ) ;
		}
		else {
			this.autoResizeAndDraw() ;
		}
	}
	else {
		// Here we have a special key

		switch( this.keyBindings[ key ] ) {
			case 'submit' :
				if ( this.disabled || this.submitted || this.canceled ) { break ; }
				//this.submitted = true ;
				this.emit( 'submit' , this.getValue() , undefined , this ) ;
				break ;

			case 'cancel' :
				if ( ! this.cancelable || this.disabled || this.canceled ) { break ; }
				//this.canceled = true ;
				this.emit( 'cancel' , this ) ;
				break ;

			case 'autoComplete' :
				if ( ! this.autoComplete ) { break ; }
				this.runAutoComplete( this.autoComplete ) ;
				break ;

			case 'historyAutoComplete' :
				if ( ! this.autoComplete ) { break ; }
				this.runAutoComplete( this.history ) ;
				break ;

			case 'historyPrevious' :
				if ( this.contentIndex <= 0 ) { break ; }
				this.contentArray[ this.contentIndex ] = this.getContent() ;
				this.contentIndex -- ;
				this.setContent( this.contentArray[ this.contentIndex ] ) ;
				this.textBuffer.runStateMachine() ;
				this.autoResizeAndDraw() ;
				break ;

			case 'historyNext' :
				if ( this.contentIndex >= this.contentArray.length - 1 ) { break ; }
				this.contentArray[ this.contentIndex ] = this.getContent() ;
				this.contentIndex ++ ;
				this.setContent( this.contentArray[ this.contentIndex ] ) ;
				this.textBuffer.runStateMachine() ;
				this.autoResizeAndDraw() ;
				break ;

			case 'backDelete' :
				this.textBuffer.backDelete() ;
				this.textBuffer.runStateMachine() ;
				this.autoResizeAndDraw() ;
				break ;

			case 'delete' :
				this.textBuffer.delete() ;
				this.textBuffer.runStateMachine() ;
				this.autoResizeAndDraw() ;
				break ;

			case 'backward' :
				this.textBuffer.moveBackward() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'forward' :
				this.textBuffer.moveForward() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'startOfWord' :
				this.textBuffer.moveToStartOfWord() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'endOfWord' :
				this.textBuffer.moveToEndOfWord() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'startOfLine' :
				this.textBuffer.moveToColumn( 0 ) ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'endOfLine' :
				this.textBuffer.moveToEndOfLine() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'left' :
				this.textBuffer.moveLeft() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'right' :
				this.textBuffer.moveRight() ;
				this.autoResizeAndDrawCursor() ;
				break ;

			case 'pasteClipboard' :
				if ( this.document ) {
					this.document.getClipboard().then( str => {
						if ( str ) {
							this.textBuffer.insert( str , this.textAttr ) ;
							this.textBuffer.runStateMachine() ;
							this.autoResizeAndDraw() ;
						}
					} )
						.catch( () => undefined ) ;
				}
				break ;

			case 'copyClipboard' :
				if ( this.document ) {
					this.document.setClipboard( this.textBuffer.getSelectionText() ).catch( () => undefined ) ;
				}
				break ;

			default :
				return ;	// Bubble up
		}
	}

	return true ;		// Do not bubble up
} ;



/*
InlineInput.prototype.onFocus = function( focus , type ) {
	this.hasFocus = focus ;
	this.updateStatus() ;
	this.draw() ;
} ;
*/


/*
InlineInput.prototype.onClick = function( data ) {
	if ( ! this.hasFocus ) {
		this.document.giveFocusTo( this , 'select' ) ;
	}
	else {
		this.textBuffer.moveTo( data.x - this.scrollX , data.y - this.scrollY ) ;
		this.drawCursor() ;
	}
} ;
*/

/*
InlineInput.prototype.onMiddleClick = function( data ) {
	if ( ! this.hasFocus ) {
		this.document.giveFocusTo( this , 'select' ) ;
	}

	// Do not moveTo, it's quite boring
	//this.textBuffer.moveTo( data.x , data.y ) ;

	if ( this.document ) {
		this.document.getClipboard( 'primary' ).then( str => {
			if ( str ) {
				this.textBuffer.insert( str , this.textAttr ) ;
				this.textBuffer.runStateMachine() ;
				this.autoResizeAndDraw() ;
			}
			//else { this.drawCursor() ; }
		} )
			.catch( () => undefined ) ;
	}
	//else { this.drawCursor() ; }
} ;
*/


// There isn't much to do ATM
//InlineInput.prototype.updateStatus = function() {} ;
