const labels={known:'뜻을 알아요',uncertain:'조금 헷갈려요',new:'처음 봐요'};
const confirmations={known:'맞아요 · 뜻을 알아요',uncertain:'헷갈려요 · 다음',new:'처음 봐요 · 다음'};
async function markFamiliarity(page,initial,final=initial){
 await page.getByRole('button',{name:labels[initial],exact:false}).click();
 await page.getByRole('button',{name:initial==='known'&&final==='uncertain'?'뜻이 헷갈려요':confirmations[initial],exact:true}).click();
 await page.getByText('저장됨',{exact:true}).waitFor();
}
module.exports={markFamiliarity};
