import {
  Directive,
  ElementRef,
  InjectionToken,
  NgZone,
  Optional,
  OnDestroy,
} from '@angular/core';
import {Directionality} from '@angular/cdk/bidi';
import {ScrollDispatcher} from './scroll-dispatcher';
import {CdkScrollable, ExtendedScrollToOptions} from './scrollable';
import {fromEvent, Observable, Subject, Observer} from 'rxjs';
import {takeUntil} from 'rxjs/operators';

export const VIRTUAL_SCROLL_CONTAINER_REF =
    new InjectionToken<VirtualScrollContainerRef>('VIRTUAL_SCROLL_CONTAINER_REF');

export interface VirtualScrollContainerRef {
  measureScrollOffset(from: 'top' | 'left' | 'right' | 'bottom' | 'start' | 'end'): number;
  measureContainerSize(orientation: 'horizontal' | 'vertical'): number;
  getViewportSize(contentSize: number): string | null;
  scrollTo(options: ExtendedScrollToOptions): any;
  elementScrolled(): Observable<Event>;
}

@Directive({
  selector: 'cdk-virtual-scroll-viewport[default]',
  providers: [{
    provide: VIRTUAL_SCROLL_CONTAINER_REF,
    useExisting: CdkVirtualScrollDefaultViewport,
  }],
  host: {
    'class': 'cdk-virtual-scroll-default-viewport',
  },
})
export class CdkVirtualScrollDefaultViewport extends CdkScrollable implements VirtualScrollContainerRef {
  measureContainerSize(orientation: 'horizontal' | 'vertical'): number {
    const viewportEl = this.elementRef.nativeElement;
    return orientation === 'horizontal' ? viewportEl.clientWidth : viewportEl.clientHeight;
  }

  getViewportSize(_: number): string | null{
    return null;
  }
}

export class RelativeParentElementRef implements ElementRef<any> {
  constructor(private _nativeElement: any) {}

  set nativeElement(_: any) {
    // ignore
  }

  get nativeElement(): any {
    // NOTE(rme): Without casting to any the following error is reached by tsc
    //
    //   error TS2339: Property 'offsetParent' does not exist on type 'HTMLElement'.
    //
    return (<any>this._nativeElement).offsetParent;
  }
}

@Directive({
  selector: 'cdk-virtual-scroll-viewport[nested]',
  providers: [{
    provide: VIRTUAL_SCROLL_CONTAINER_REF,
    useExisting: CdkVirtualScrollNestedViewport,
  }],
  host: {
    'class': 'cdk-virtual-scroll-nested-viewport',
  },
})
export class CdkVirtualScrollNestedViewport extends CdkScrollable implements VirtualScrollContainerRef {
  constructor(
    private viewportRef: ElementRef,
    scrollDispatcher: ScrollDispatcher,
    ngZone: NgZone,
    @Optional() dir: Directionality,
  ) {
    super(new RelativeParentElementRef(viewportRef.nativeElement), scrollDispatcher, ngZone, dir);
  }

  measureScrollOffset(from: 'top' | 'left' | 'right' | 'bottom' | 'start' | 'end'): number {
    const offset = super.measureScrollOffset(from);

    if (from == 'top') {
      return offset - this.viewportRef.nativeElement.offsetTop;
    }

    // TODO from == left, right, bottom, start and end

    return offset;
  }

  measureContainerSize(orientation: 'horizontal' | 'vertical'): number {
    return orientation === 'horizontal' ? this.getParentNativeElement().clientWidth : this.getParentNativeElement().clientHeight;
  }

  getViewportSize(contentSize: number): string | null {
    return contentSize + 'px';
  }

  private getParentNativeElement() {
    return this.viewportRef.nativeElement.offsetParent;
  }
}

@Directive({
  selector: 'cdk-virtual-scroll-viewport[window]',
  providers: [{
    provide: VIRTUAL_SCROLL_CONTAINER_REF,
    useExisting: CdkVirtualScrollWindowViewport,
  }],
  host: {
    'class': 'cdk-virtual-scroll-window-viewport',
  },
})
export class CdkVirtualScrollWindowViewport implements VirtualScrollContainerRef, OnDestroy {
  private _destroyed = new Subject();

  private _elementScrolled: Observable<Event> = Observable.create((observer: Observer<Event>) =>
      this.ngZone.runOutsideAngular(() =>
          fromEvent(window, 'scroll').pipe(takeUntil(this._destroyed))
              .subscribe(observer)));

  constructor(protected elementRef: ElementRef,
              protected ngZone: NgZone,
              @Optional() protected dir?: Directionality) {}

  ngOnDestroy() {
    this._destroyed.next();
    this._destroyed.complete();
  }

  measureScrollOffset(from: 'top' | 'left' | 'right' | 'bottom' | 'start' | 'end'): number {
    if (from == 'top') {
      return -this.elementRef.nativeElement.getBoundingClientRect().top;
    }

    // TODO(rme) from == left, right, bottom, start and end

    return 0;
  }

  measureContainerSize(orientation: 'horizontal' | 'vertical'): number {
    return orientation === 'horizontal' ? window.innerWidth : window.innerHeight;
  }

  getViewportSize(contentSize: number): string | null{
    return contentSize + 'px';
  }

  /** Returns observable that emits when a scroll event is fired on the host element. */
  elementScrolled(): Observable<Event> {
    return this._elementScrolled;
  }

  /**
   * TODO(rme) doc + implement the following with dir (bottom, left, right) and rtl
   */
  scrollTo(options: ExtendedScrollToOptions): void {
    window.scrollTo(options);
  }
}
