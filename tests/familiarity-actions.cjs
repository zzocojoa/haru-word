const labels={known:'뜻을 알아요',uncertain:'조금 헷갈려요',new:'처음 봐요'};
const confirmations={known:'맞아요 · 안다로 확정',uncertain:'헷갈림으로 확정 · 다음',new:'처음으로 확정 · 다음'};
async function markFamiliarity(page,initial,final=initial){
 await page.getByRole('button',{name:labels[initial],exact:false}).click();
 await page.getByRole('button',{name:initial==='known'&&final==='uncertain'?'불확실해요 · 헷갈림으로 확정':confirmations[initial],exact:true}).click();
 await page.getByText('서버에 저장됨',{exact:true}).waitFor();
}
module.exports={markFamiliarity};
