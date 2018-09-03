import React, { Component } from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import { fullscreen, exitfullscreen, addFullscreenchangeEvent, checkFullscreen } from '../../utils';
import { throttle } from 'lodash';
import './style/index.less';

const CON_MAX_WIDTH = 1024, //容器最大宽度
  CON_MIN_WIDTH = 360, //容器最小宽度
  CON_MAX_HEIGHT = 768, //容器最大高度
  CON_MIN_HEIGHT = 360, //容器最小高度
  MAX_RATIO = 5, //最大的图片显示比例
  MIN_RATIO = 0.1, //最小的图片显示比例
  STEP_RATIO = 0.1, //图片缩放比例步长
  DEFAULT_RATIO = 0.8; //默认的图片显示比例

function num2px(num) {
  return parseInt(num, 10) + 'px';
}

function px2num(str) {
  return Number(str.replace('px', '')) || 0;
}

/**
 * el1元素的区域是否超过el2元素
 * @param  {[type]}  el1 [description]
 * @param  {[type]}  el2 [description]
 * @return {Boolean}     [description]
 */
function isLargger(el1, el2) {
  return el1.clientHeight > el2.clientHeight || el1.clientWidth > el2.clientWidth;
}

const setStyle = (el, css) => {
  for (let key in css) {
    el.style[key] = css[key];
  }
};

const getImageSize = function(image, callback, scope) {
  var newImage;

  // Modern browsers
  if (image.naturalWidth) {
    return callback.call(scope, image.naturalWidth, image.naturalHeight);
  }

  // IE8: Don't use `new Image()` here
  newImage = document.createElement('img');
  newImage.onload = function() {
    callback.call(scope, this.width, this.height);
  };
  newImage.src = image.src;
}

const SPECIAL_CHARS_REGEXP = /([:\-_]+(.))/g;
const MOZ_HACK_REGEXP = /^moz([A-Z])/;
const camelCase = function(name) {
  return name.replace(
    SPECIAL_CHARS_REGEXP, (_, separator, letter, offset) => offset
    ? letter.toUpperCase()
    : letter).replace(MOZ_HACK_REGEXP, 'Moz$1');
};

/**
 * 获取元素的样式
 * @param  {[type]} element   [description] 元素标签
 * @param  {[type]} styleName [description] 样式名
 * @return {[type]}           [description]
 */
const getStyle = function(element, styleName) {
  if (!element || !styleName)
    return null;

  styleName = camelCase(styleName);

  if (styleName === 'float')
    styleName = 'cssFloat';

  try {
    const computed = document.defaultView.getComputedStyle(element, '');
    return element.style[styleName] || computed
      ? computed[styleName]
      : null;
  } catch (e) {
    return element.style[styleName];
  }
};

class PicturePreview extends Component {
  static propTypes = {
    prefixCls: PropTypes.string,
    className: PropTypes.string,
    children: PropTypes.node,
    toolbar: PropTypes.bool,
    source: PropTypes.array,
    dragable: PropTypes.bool,
    visible: PropTypes.bool,
    activeIndex: PropTypes.number,
    onClose: PropTypes.func,
  };

  static defaultProps = {
    prefixCls: 'fishd-picturepreview',
    toolbar: false,
    source: [], // [{name: '', src: ''}]
    dragable: false,
    visible: false,
    activeIndex: 0,
    onClose: () => {},
  };

  constructor(props) {
    super(props);

    this.state = {
      current: props.activeIndex || 0,
      show: props.visible || false,
      imgs: props.source || [],
      container: {
        style: null,
        isFull: false //是否全屏
      },
      image: {
        el: null,
        ratio: 0 //图片的缩放比例
      },
      shown: false, //标记是否显示过，第一次显示时居中显示
      moving: '' //表示移动的目标  'img'表示正在移动图片 'con'表示正在移动容器 ''表示没有移动
    };
  }

  componentDidMount() {
    const { dragable, toolbar } = this.props;

    document.body.appendChild(this.$el);
    this.setContainerStyle();

    if (toolbar) {
      // 监听全屏事件
      this.$el.addEventListener("fullscreenchange", this.handleFullChange);
      this.$el.addEventListener("mozfullscreenchange", this.handleFullChange);
      this.$el.addEventListener("webkitfullscreenchange", this.handleFullChange);
    }

    if (dragable) {
      // 监听拖动事件
      document.addEventListener('mousemove', this.handleMouseMove);
      document.addEventListener('mouseup', this.handleMouseUp);
    }
  }

  componentWillReceiveProps(nextProps) {
    const { current, show, imgs } = this.state;
    const { activeIndex, visible, source, children } = nextProps;

    if (activeIndex != current) {
      this.setState({
        current: activeIndex
      }, () => {
        this.setContainerStyle();
      });
    }

    if (visible != show) {
      this.setState({
        show: visible
      });
    }

    if (source && source.length) {
      let sourceStr = JSON.stringify(source);

      if (sourceStr != JSON.stringify(imgs)) {
        this.setState({
          imgs: JSON.parse(sourceStr)
        }, () => {
          this.setContainerStyle();
        });
      }
    } else if (children) {
      let imgList = [];

      imgList = React.Children.map(children, (child, index) => {
        let { props, type } = child, img = {};

        if (type === 'img') {
          img.name = props.name || props.alt;
          img.src = props.src;
        }

        return img;
      }).filter((item) => item);

      this.setState({
        imgs: imgList
      }, () => {
        this.setContainerStyle();
      });
    }
  }

  // shouldComponentUpdate(nextProps, nextState) {
  //   // if (JSON.stringify(this.state) === JSON.stringify(nextState)) {
  //   //   return false;
  //   // }

  //   return true;
  // }

  componentDidUpdate(prevProps, prevState) {
    // if (this.props.controller && this.contentWrap != undefined && this.hasAddExitfullscreenEvt == false) {
    //   // 处理通过按“Esc”键退出全屏的情况
    //   addFullscreenchangeEvent(this.contentWrap, (e) => {
    //     if (!checkFullscreen() && this.state.isFullscreen == true) {
    //       this.setState({
    //         isFullscreen: false
    //       });
    //     }
    //   });

    //   this.hasAddExitfullscreenEvt = true;
    // }
  }

  componentWillUnmount() {
    if (this.$el && this.$el.parentNode === document.body) {
      document.body.removeChild(this.$el);
    }

    if (this.props.dragable) {
      document.removeEventListener('mousemove', this.handleMouseMove);
      document.removeEventListener('mouseup', this.handleMouseUp);
    }
  }

  /**
   * 设置容器的样式，用于切换图片时，根据图片大小，确定容器的尺寸以及位置
   */
  setContainerStyle = () => {
    if (!this.state.image.el) return;

    getImageSize(this.state.image.el, (naturalWidth, naturalHeight) => {
      //计算容器的宽度
      var width = naturalWidth * DEFAULT_RATIO; //默认0.8倍显示图片
      if (width > CON_MAX_WIDTH)
        width = CON_MAX_WIDTH;
      if (width < CON_MIN_WIDTH)
        width = CON_MIN_WIDTH;

      //计算图片的缩放比例
      // this.state.image.ratio = width / naturalWidth;
      var imgRatio = (width / naturalWidth) || 0;

      //计算容器的高度
      var height = naturalHeight * imgRatio;
      if (height > CON_MAX_HEIGHT)
        height = CON_MAX_HEIGHT;
      if (height < CON_MIN_HEIGHT)
        height = CON_MIN_HEIGHT;

      var css = '';
      if (!this.state.shown) {
        css = {
            width: num2px(width),
            height: num2px(height),
            left: num2px((window.innerWidth - width) / 2),
            top: num2px((window.innerHeight - height) / 2)
        };

        this.setState({
          container: {
            style: css,
            isFull: this.state.container.isFull
          }
        });
      } else if (!this.state.container.isFull) {
        var oriTop = px2num(getStyle(this.$el, 'top')),
            oriLeft = px2num(getStyle(this.$el, 'left')),
            oriWidth = px2num(getStyle(this.$el, 'width')),
            oriHeight = px2num(getStyle(this.$el, 'height'));
        css = {
            width: num2px(width),
            height: num2px(height),
            left: num2px(oriLeft + (oriWidth - width) / 2),
            top: num2px(oriTop + (oriHeight - height) / 2)
        };

        this.setState({
          container: {
            style: css,
            isFull: this.state.container.isFull
          }
        });
      }

      this.setState({
        image: Object.assign({}, this.state.image, {
          naturalWidth: naturalWidth,
          naturalHeight: naturalHeight,
          ratio: imgRatio
        })
      }, () => {
        //等视图更新后，再缩放，要用到con的尺寸
        this.handleZoom(imgRatio);
      });
    });
  };

  isFullEnabled = () => {
    return document.fullscreenEnabled || document.mozFullScreenEnabled || document.webkitFullscreenEnabled || document.msFullscreenEnabled;
  };

  isOne2One = () => {
    return Math.round(this.state.image.ratio * 100) === 100;
  };

  handleClose = () => {
    const { onClose } = this.props;

    this.state.container.isFull && exitfullscreen();
    this.setState({
      show: false,
      shown: false,
      container: {
        style: this.state.container.style,
        isFull: false
      }
    }, () => {
      if (onClose && typeof onClose == "function") {
        onClose();
      }
    });
  };

  handlePrev = () => {
    this.setState({
      current: this.state.current <= 0 ? (this.state.imgs.length - 1) : (this.state.current - 1),
      shown: true
    }, () => {
      this.setContainerStyle();
    });
  };

  handleNext = () => {
    this.setState({
      current: this.state.current >= (this.state.imgs.length - 1) ? 0 : (this.state.current + 1),
      shown: true
    }, () => {
      this.setContainerStyle();
    });
  };

  handleZoom = (ratio) => {
    let image = {};

    //已经是1:1的情况下，不处理
    if (ratio === 1 && this.isOne2One()) return;

    //缩放比例限定范围在0.1和5之间
    ratio = Math.min(ratio, MAX_RATIO);
    ratio = Math.max(ratio, MIN_RATIO);

    image.ratio = ratio;

    let width = this.state.image.naturalWidth * ratio,
        height = this.state.image.naturalHeight * ratio;

    image.marginL = (this.$el.clientWidth - width) / 2;
    image.marginT = (this.$el.clientHeight - height) / 2;

    this.setState({
      image: Object.assign({}, this.state.image, image)
    }, () => {
      setStyle(this.state.image.el, {
        'margin-left': num2px(image.marginL),
        'margin-top': num2px(image.marginT),
        width: num2px(width),
        height: num2px(height)
      });
    });
  };

  handleSwitchFull = () => {
    if (!this.isFullEnabled()) return;

    this.state.container.isFull ? exitfullscreen() : fullscreen(this.$el);
  };

  handleRotate = () => {
    var old = this.state.image.el.rotateValue || 0,
        rotate = old + 90,
        transform = 'rotate(' + rotate + 'deg)';

    this.state.image.el.rotateValue = rotate;

    setStyle(this.state.image.el, {
      '-webkit-ransform': transform,
      '-ms-transform': transform,
      'transform': transform
    });
  };

  handleSave = () => {
    let img = this.state.image.el;

    // for IE10+
    if (window.navigator.msSaveBlob) {
      let xhr = new XMLHttpRequest();
      xhr.open('GET', img.src , true);
      xhr.responseType = 'blob';
      xhr.onreadystatechange = function () {
        if (xhr.readyState == xhr.DONE) {
          window.navigator.msSaveBlob(xhr.response);
        }
      };
      xhr.send();
    }
    //  else {
    //   let a = document.createElement('a');
    //   // a.download = '';
    //   // a.href = img.src;
    //   a.setAttribute('download', '');
    //   a.setAttribute('href', img.src);
    //   a.click();
    // }
  };

  handleFullChange = (e) => {
    var con = this.state.container;

    if (con.isFull) {
      //从全屏退出到非全屏时，认为是没有显示过，让图片居中显示
      this.setState({
        shown: false
      }, () => {
        this.setContainerStyle();
        this.setState({
          shown: true
        });
      });
    } else {
      con.style = {
        left: 0,
        top: 0,
        width: '100%',
        height: '100%'
      };
      //等视图更新后，再缩放，要用到con的尺寸
      this.setState({
        container: con
      }, () => this.handleZoom(this.state.image.ratio));
    }

    this.setState({
      container: {
        style: this.state.container.style,
        isFull: !con.isFull
      }
    });
  };

  handleMouseDown = (e) => {
    var con = {}, image = {}, tar = e.target;

    if (tar === this.state.image.el && (this.state.container.isFull || isLargger(this.state.image.el, this.$el))) {
      //点击在图片上，并且是全屏模式或者图片比容器大，此时移动图片
      image.startX = e.pageX;
      image.startY = e.pageY;
      image.marginL = px2num(getStyle(this.state.image.el, 'margin-left'));
      image.marginT = px2num(getStyle(this.state.image.el, 'margin-top'));

      this.setState({
        moving: 'img',
        image: Object.assign({}, this.state.image, image)
      });
    } else if (!this.state.container.isFull) {
      //非全屏模式下，移动容器
      con.rect = this.$el.getBoundingClientRect();
      con.startX = e.clientX;
      con.startY = e.clientY;

      this.setState({
        moving: 'con',
        container: Object.assign({}, this.state.container, con)
      });
    } else {
      e.preventDefault();
    }
  };

  handleMouseMove = (e) => {
    var con = this.state.container,
        image = this.state.image,
        conStyle = {...con.style};

    if (this.state.moving) {
      e.preventDefault();

      if (this.state.moving === 'img') {
        setStyle(image.el, {
          'margin-left': num2px(e.pageX - image.startX + image.marginL),
          'margin-top': num2px(e.pageY - image.startY + image.marginT)
        });

        // this.setState({
        //   image: Object.assign({}, this.state.image, image)
        // });
      } else if (this.state.moving === 'con') {
        conStyle.left = num2px(e.pageX - con.startX + con.rect.left);
        conStyle.top = num2px(e.pageY - con.startY + con.rect.top);

        this.setState({
          container: Object.assign({}, this.state.container, {style: conStyle})
        });
      }
    }
  };

  handleMouseUp = (e) => {
    this.setState({
      moving: ''
    });
  };

  render() {
    const { show, current, imgs, image } = this.state;
    const { className, prefixCls, source, children, toolbar, dragable } = this.props;
    let ctnerClass = classNames(prefixCls, {
      [className]: className,
      'dragable': dragable,
      'hide': !show
    });
    let isHide = !(source.length > 1 || (!!children && children.length > 1));
    let leftBtnClass = classNames({
      'prev': true,
      'fishdicon': true,
      'fishdicon-left': true,
      'hide': isHide
    });
    let rightBtnClass = classNames({
      'next': true,
      'fishdicon': true,
      'fishdicon-right': true,
      'hide': isHide
    });
    let toolbarClass = classNames('toolbar', {
      'hide': !toolbar
    });
    let one2oneClass = classNames('fishdicon fishdicon-search-line icon', {
      'hide': false
    });
    let fullscreenClass = classNames('fishdicon fishdicon-search-line icon', {
      'hide': false
    });
    let zoomInClass = classNames('fishdicon fishdicon-search-line icon', {
      'hide': false
    });
    let zoomOutClass = classNames('fishdicon fishdicon-search-line icon', {
      'hide': false
    });

    return (
      <div className={ctnerClass} ref={node => this.$el = node} style={this.state.container.style}
        onMouseDown={dragable ? this.handleMouseDown : null} >
        <i className="fishdicon fishdicon-close-modal-line close" onClick={this.handleClose}/>
        <i className={leftBtnClass} onClick={this.handlePrev}/>
        <i className={rightBtnClass} onClick={this.handleNext}/>

        <div className="canvas">
          {
            imgs.map((item, index) => {
              if (current === index) {
                return (
                  <img key={'pic_'+index}
                    className='img'
                    src={item.src}
                    alt={item.name} 
                    active='true'
                    ref={node => this.state.image.el = node}
                  />
                );
              } else {
                return (
                  <img key={'pic_'+index}
                    className='img'
                    src={item.src}
                    alt={item.name}
                  />
                );
              }
            })
          }
        </div>

        <div className={toolbarClass}>
          <div className="toolbarTitle">{current+1}/{imgs.length}</div>
          <div className="toolbarCon">
            <i className={one2oneClass} onClick={this.handleZoom.bind(this, 1)}/>
            <i className={fullscreenClass} onClick={this.handleSwitchFull}/>
            <i className={zoomInClass} onClick={this.handleZoom.bind(this, image.ratio + STEP_RATIO)}/>
            <i className={zoomOutClass} onClick={this.handleZoom.bind(this, image.ratio - STEP_RATIO)}/>
            <i className="fishdicon fishdicon-search-line icon" onClick={this.handleRotate}/>
            <a download={imgs[current] && imgs[current].name} href={imgs[current] && imgs[current].src}>
              <i className="fishdicon fishdicon-download-line icon" onClick={this.handleSave}/>
            </a>
          </div>
        </div>
      </div>
    );
  }
}

export default PicturePreview;
