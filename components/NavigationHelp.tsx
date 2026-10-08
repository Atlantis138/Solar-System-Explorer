import React from 'react';
import FloatingPanel from './FloatingPanel';
export default function NavigationHelp({onClose}:{onClose:()=>void}) {
  return <FloatingPanel id="navigation-help" title="操作指南" side="center" top={48} onClose={onClose}>
    <div className="navigation-help">
      <h3>观察与移动</h3>
      <dl>{[
        ['W / S','前进 / 后退'],['A / D','向左 / 向右'],['R / F','升高 / 降低'],['Q / E','向左 / 向右滚转'],['↑ ↓ ← →','转向'],['V','环绕 / 原地漫游'],['Home','看向太阳，再次俯视'],
      ].map(([key,label])=><React.Fragment key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></React.Fragment>)}</dl>
      <p>左键／中键拖动或触屏单指拖动平移；右键拖动或右摇杆转向。环绕围绕原目标旋转，平移可以把目标移到画面边缘。左摇杆、WASD 与 R/F 移动，松手即停；视角移动默认开启，关闭后摇杆隐藏，键盘移动停止。</p>
      <p>环绕时，滚轮／双指捏合拉近或拉远，双指同向拖动平移。漫游时，滚轮调航速倍率；双指展开快速前进、合拢后退，不改变倍率。视场只在设置中调整。</p>
      <p>航速自动适应位置，太阳系到星际平滑提速，靠近天体或当前恒星目标自动放慢，可用滚轮或设置里的航速倍率调节快慢。左上 SPD 显示倍率与实际航速，POS 是日心坐标（AU／LY），ATT 依次为倾角、方向、滚转。</p>
      <p>进入漫游保留位置和朝向；返回环绕恢复原目标，并保留偏移构图。如果目标已经在身后，会重新朝向目标。Home 可看向太阳，再次俯视；关闭导航会停止移动并恢复目标环绕。</p>
      <h3>时间与工具</h3>
      <dl>{[
        ['Space','播放 / 暂停'],['− / +','时间减速 / 加速'],['B','时间反向'],['T / 0','调整日期 / 回到现在'],['M','系统设置'],['N','邻近恒星 / 太阳系'],['C','启用 / 关闭视角移动'],['J','天象搜寻（高精度模式）'],['X','示意 / 真实比例'],['O / L','轨道 / 恒星名称'],['H 或 ?','操作指南'],['Esc','关闭最上层面板'],
      ].map(([key,label])=><React.Fragment key={key}><dt><kbd>{key}</kbd></dt><dd>{label}</dd></React.Fragment>)}</dl>
      <p>拖动信息面板标题可移动；− 原地收起，图钉置顶。系统设置为固定菜单。输入文字或调整滑块时，快捷键不会接管操作。</p>
    </div>
  </FloatingPanel>;
}
