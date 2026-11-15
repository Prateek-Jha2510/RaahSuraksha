// Local tangent-plane distance from a rounded street segment to a route polyline.
export function nearStreet(point,points){
  const scale=111195, east=scale*Math.cos(point[0]*Math.PI/180);
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const x=(a[1]-point[1])*east,y=(a[0]-point[0])*scale;
    const dx=(b[1]-a[1])*east,dy=(b[0]-a[0])*scale;
    const len=dx*dx+dy*dy;
    const t=len?Math.min(1,Math.max(0,-(x*dx+y*dy)/len)):0;
    if(Math.hypot(x+t*dx,y+t*dy)<=30)return true;
  }
  return false;
}

