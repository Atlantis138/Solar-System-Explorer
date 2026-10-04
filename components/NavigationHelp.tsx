import React from 'react';
import FloatingPanel from './FloatingPanel';
export default function NavigationHelp({onClose}:{onClose:()=>void}) {
  return <FloatingPanel id="navigation-help" title="操作指南" side="center" top={48} onClose={onClose}>
    <div className="navigation-help">
      <h3>观察与移动</h3>
      <dl>{[
        ['W / S','前进 / 后退'],['A / D','向左 / 向右'],['R / F','升高 / 降低'],['Q / E','向左 / 向右滚转'],['↑ ↓ ← →','转向'],['Shift + 移动','3 倍速度'],['V','环绕 / 原地漫游'],['Home','看向太阳，再次俯视'],
      ].map(([key,label])=><React.Fragment key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></React.Fragment>)}</dl>
      <p>左拖平移；右拖（或 Alt + 左拖）转向；滚轮 / 双指缩放调整距离。漫游时触屏左摇杆移动、右摇杆转向，可同时使用；环绕时仅显示右摇杆。左侧箭头控制升降。双指在画面旋转可滚转。</p>
      <p>移动键自动进入漫游。环绕围绕当前目标转动；漫游保持观察者位置。视场角、投影方式和移动速度可在设置 → 视角中调整。</p>
      <h3>时间与工具</h3>
      <dl>{[
        ['Space','播放 / 暂停'],['− / +','时间减速 / 加速'],['B','时间反向'],['T / 0','调整日期 / 回到现在'],['M','系统设置'],['N','邻近恒星 / 太阳系'],['C','启用 / 关闭视角移动'],['J','天象搜寻（高精度模式）'],['X','示意 / 真实比例'],['O / L','轨道 / 恒星名称'],['H 或 ?','操作指南'],['Esc','关闭最上层面板'],
      ].map(([key,label])=><React.Fragment key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></React.Fragment>)}</dl>
      <p>拖动信息面板标题可移动；− 原地收起，图钉置顶。系统设置为固定菜单。输入文字或调整滑块时，快捷键不会接管操作。</p>
    </div>
  </FloatingPanel>;
}
