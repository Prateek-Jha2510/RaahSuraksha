// Input: detour minutes, safer flag, route count, then seconds and risk (-1 unknown).
int chooseRoute() {
    double limit;
    int safer, count;
    if (!(std::cin >> limit >> safer >> count) || count < 1 || limit < 0) return 1;
    std::vector<double> seconds(count), risk(count);
    for (int i=0; i<count; ++i) if (!(std::cin >> seconds[i] >> risk[i])) return 1;
    int fastest=std::min_element(seconds.begin(),seconds.end())-seconds.begin();
    int best=-1;
    if (safer) for (int i=0; i<count; ++i) {
        if (seconds[i]>seconds[fastest]+60*limit || risk[i]<0) continue;
        if (best<0 || risk[i]<risk[best] || (risk[i]==risk[best] && seconds[i]<seconds[best])) best=i;
    }
    std::cout << (best<0 ? fastest : best) << '\n';
    return 0;
}
