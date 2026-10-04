interface Point {x:number;y:number}
interface Node {p:Point;rank:number;axis:'x'|'y';left:Node|null;right:Node|null;minRank:number;minX:number;maxX:number;minY:number;maxY:number}
/** Exact nearest higher-priority neighbor queries. Balanced tree avoids quadratic
 * work when thousands of zoomed-out stars fall inside one screen grid cell. */
export function nearestBrighterDistances(points:Point[],radius:number):number[] {
  const indices=points.map((_,i)=>i);
  const select=(from:number,to:number,mid:number,axis:'x'|'y')=>{
    const compare=(a:number,b:number)=>points[a][axis]-points[b][axis]||a-b;
    while(from<to){
      const pivot=indices[(from+to)>>1];let i=from,j=to;
      while(i<=j){
        while(compare(indices[i],pivot)<0)i++;while(compare(indices[j],pivot)>0)j--;
        if(i<=j){[indices[i],indices[j]]=[indices[j],indices[i]];i++;j--;}
      }
      if(mid<=j)to=j;else if(mid>=i)from=i;else break;
    }
  };
  const build=(from:number,to:number,depth:number):Node|null=>{
    if(from>=to)return null;
    const axis=depth%2?'y':'x',mid=(from+to)>>1;select(from,to-1,mid,axis);
    const rank=indices[mid],p=points[rank],left=build(from,mid,depth+1),right=build(mid+1,to,depth+1);
    return {p,rank,axis,left,right,minRank:Math.min(rank,left?.minRank??Infinity,right?.minRank??Infinity),
      minX:Math.min(p.x,left?.minX??Infinity,right?.minX??Infinity),maxX:Math.max(p.x,left?.maxX??-Infinity,right?.maxX??-Infinity),
      minY:Math.min(p.y,left?.minY??Infinity,right?.minY??Infinity),maxY:Math.max(p.y,left?.maxY??-Infinity,right?.maxY??-Infinity)};
  };
  const root=build(0,points.length,0);
  return points.map((p,rank)=>{
    let best=radius*radius;
    const visit=(node:Node|null)=>{
      if(!node||node.minRank>=rank||best===0)return;
      const dx=Math.max(0,node.minX-p.x,p.x-node.maxX),dy=Math.max(0,node.minY-p.y,p.y-node.maxY);
      if(dx*dx+dy*dy>=best)return;
      if(node.rank<rank)best=Math.min(best,(node.p.x-p.x)**2+(node.p.y-p.y)**2);
      const first=p[node.axis]<node.p[node.axis]?node.left:node.right;
      visit(first);visit(first===node.left?node.right:node.left);
    };
    visit(root);return Math.sqrt(best);
  });
}
